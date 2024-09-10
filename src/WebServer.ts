import * as http from 'http';
import * as fs from 'fs';
import { Discord } from './discord.js';
import { Types } from './Types.js'
import { CloseWebSockets, WebsocketClient_BotUser, WebsocketClient_Broadcaster } from './WebSockets.js';
import { BotUserAccessToken, db } from './Database.js';
import * as Request from './Requests.js';
import * as WebSocket from 'ws';
import { saveStreamToFile, sql_format_string } from './util.js';
import { Readable } from 'stream';
import { log } from './logging.js';

import os from 'os';

function getLocalIPAddress(): string | undefined {
    const networkInterfaces = os.networkInterfaces();
    
    for (const interfaceName in networkInterfaces) {
        const addresses = networkInterfaces[interfaceName];
        
        if (addresses) {
            for (const addressInfo of addresses) {
                if (addressInfo.family === 'IPv4' && !addressInfo.internal) {
                    return addressInfo.address;
                }
            }
        }
    }
    return undefined; // Return undefined if no local address is found
}
const localIP = getLocalIPAddress();
if (localIP) {
    console.log(`Local IP address: ${localIP}`);
} else {
    console.log('Could not determine local IP address.');
	process.exit(-1);
}

const host = localIP;
const port = 8000;

function GetDirectoryPage(path: string, PageInput: any = {}): string {
	PageInput.ServerAddress = host;
	PageInput.ServerPort = port;
	const pageInput = JSON.stringify(PageInput);  // Stringify the object on the server side
	const escapedPageInput = pageInput
	    .replace(/\\/g, '\\\\')  // Escape backslashes
	    .replace(/'/g, "\\'")    // Escape single quotes
	    .replace(/"/g, '\\"');   // Escape double quotes
	var content: string = "";
	content += fs.readFileSync(`${path}/.html`);
	content += "<style>"+fs.readFileSync(`./web/colors.css`)+"</style>";
	content += "<style>"+fs.readFileSync(`./web/font.css`)+"</style>";
	content += "<style>"+fs.readFileSync(`./web/icons.css`)+"</style>";
	content += "<style>"+fs.readFileSync(`./web/prism.css`)+"</style>";
	content += "<style>"+fs.readFileSync(`${path}/.css`)+"</style>";
	content += "<script>"+fs.readFileSync(`${path}/.js`)+"</script>";
	content += "<script>"+fs.readFileSync(`./web/shared.js`)+"</script>";
	content += "<script>"+fs.readFileSync(`./web/prism.js`)+"</script>";
	content += `
	<script>
	window.pagelib.PageInput = JSON.parse('${escapedPageInput}');
	window.pagelib.main();
	</script>
	`;
	return content;
}

function GetStatusPage(code: number,text: string): string {
	var content: string = "";
	content += GetDirectoryPage('./web/error-page',{
		code: code,
		text: text
	});
	return content;
}

function GetReactApp(path: string, PageInput: any = {}): string {
	PageInput.ServerAddress = host;
	PageInput.ServerPort = port;
	var content: string = "";
	content += `
	<script>
	window.pagelib.PageInput = JSON.parse('${JSON.stringify(PageInput)}');
	window.pagelib.main();
	</script>
	`;
	content += "<style>"+fs.readFileSync(`./web/colors.css`)+"</style>";
	content += "<style>"+fs.readFileSync(`./web/font.css`)+"</style>";
	content += fs.readFileSync(`${path}/build/index.html`);
	return content;
}

namespace HttpResponse {
	export namespace OK {
		export function json(res: http.ServerResponse,data: any): void {
			res.setHeader("Content-Type", "application/json");
			res.writeHead(200);
			res.end(JSON.stringify(data));
		}
	}
	export function NotFound(res: http.ServerResponse): void {
		res.setHeader("Content-Type", "text/html");
		res.writeHead(404);
		res.end(GetStatusPage(404,"Page not found"));
	}
	export function InvalidMethod(res: http.ServerResponse): void {
		res.setHeader("Content-Type", "text/html");
		res.writeHead(405);
		res.end(GetStatusPage(405,"Invalid method"));
	}
	export function Unauthorized(res: http.ServerResponse): void {
		res.setHeader("Content-Type", "text/html");
		res.writeHead(401);
		res.end(GetStatusPage(401,"Unauthorized"));
	}
	export function SQLError(res: http.ServerResponse,error: string): void {
		res.setHeader("Content-Type", "text/html");
		res.writeHead(500);
		res.end(GetStatusPage(500,`SQL Error<br>${error}`));
	}
}

async function ServeFile(url: string, res: http.ServerResponse): Promise<void> {
	if(!(fs.existsSync('.'+url))) {
		return HttpResponse.NotFound(res);
	}
	switch(url.split('.').pop()) {
		case('js'):
		res.setHeader("Content-Type", "text/javascript");
		break;
		case('css'):
		res.setHeader("Content-Type", "text/stylesheet");
		break;
		case('html'):
		res.setHeader("Content-Type", "text/html");
		break;
		case('json'):
		res.setHeader("Content-Type", "application/json");
		break;
		default:
		res.setHeader("Content-Type", "text/html");
	}
}

var DashboardClient: WebSocket.WebSocket | undefined;
export async function SendDashboardMessage(data: Types.DashboardServerMessage) {
	DashboardClient?.send(JSON.stringify(data));
}
export async function SendDashboardChat(username: string,message: string,icons: string[],platform_icon: string) {
	DashboardClient?.send(JSON.stringify({
		type: 'chat-message',
		object: {
			message: message,
			username: username,
			icons: icons,
			platform_icon: platform_icon
		}
	}));
}

async function CreateCacheEntry(source: string, location: string, DataURL: string): Promise<number> {
	let DataResponse = await fetch(
		DataURL,{
			method: 'GET'
		}
	);
	if(DataResponse.body != null) {
		saveStreamToFile(DataResponse.body,`./cache/${location}`);
		await db.query(
			`SELECT * FROM Cache WHERE source='${sql_format_string(source)}' AND IP='${host}'`
		).then((rows: any[]) => {
			if(rows.length > 0)  {
				db.query(
					`UPDATE Cache SET location='${sql_format_string(location)}' WHERE source='${sql_format_string(source)}' AND IP='${host}'`
				).then((rows: any[]) => {/*console.log(rows);*/}).catch(err => {console.log(err);});
			} else {
				db.query(
					`INSERT INTO Cache (source,location,IP) VALUES ('${sql_format_string(source)}','${sql_format_string(location)}','${host}')`
				).then((rows: any[]) => {/*console.log(rows);*/}).catch(err => {console.log(err);});
			}
		}).catch(err => {console.log(err);});
	}
	return DataResponse.status;
}

var BlockTwitchBadgeRefresh: Promise<number> | undefined;
async function DoRefreshTwitchBadges(resolve: (value: number) => void, reject: (reason?: any) => void) {
	let response = await Request.Twitch.Synchronous(
		`https://api.twitch.tv/helix/chat/badges/global`,{
			method: 'GET'
		},BotUserAccessToken
	);
	if(response.status == 200) {
		const bj: any = await response.json();
		const body: {
			data: Array<{
				set_id: string
				versions: Array<{
					id: string
					image_url_1x: string
					image_url_2x: string
					image_url_4x: string
					title: string
					description: string
					click_action: string
					click_url: string
				}>
			}>
		} = bj;
		for (let index = 0; index < body.data.length; index++) {
			const set = body.data[index];
			for (let sidx = 0; sidx < set.versions.length; sidx++) {
				const version = set.versions[sidx];
				await CreateCacheEntry(
					`CandyInspector/twitch-badge/${set.set_id}/${version.id}/1x`,
					`twitch-badge-${set.set_id}-${version.id}-1x`,
					version.image_url_1x
				);
				await CreateCacheEntry(
					`CandyInspector/twitch-badge/${set.set_id}/${version.id}/2x`,
					`twitch-badge-${set.set_id}-${version.id}-2x`,
					version.image_url_2x
				);
				await CreateCacheEntry(
					`CandyInspector/twitch-badge/${set.set_id}/${version.id}/4x`,
					`twitch-badge-${set.set_id}-${version.id}-4x`,
					version.image_url_4x
				);
			}
		}
	}
	resolve(response.status);
}
async function RefreshTwitchBadges(): Promise<number> {
	if(BlockTwitchBadgeRefresh) {
		console.log('twitch badges already refreshing, waiting...');
		let status = await BlockTwitchBadgeRefresh;
		console.log('twitch badges refreshed by another thread.');
		return status;
	}
	console.log('refreshing twitch badges...');
	BlockTwitchBadgeRefresh = new Promise<number>(DoRefreshTwitchBadges);
	let status = await BlockTwitchBadgeRefresh;
	console.log('twitch badges refreshed by this thread.');
	BlockTwitchBadgeRefresh = undefined;
	return status;
}

export async function ResolveCache(url: string,res: http.ServerResponse) {
	//console.log(`loading resource from cache - ${url}`);
	return await db.query(
		`SELECT * FROM Cache WHERE source='${sql_format_string(url)}' AND IP='${host}'`
	).then(async (rows: any[]) => {
		if(rows.length < 1) {
			//! cache miss
			console.log(`cache miss - ${url}`);
			if(url.startsWith('CandyInspector/twitch-badge/')) {
				RefreshTwitchBadges();
				return await db.query(
					`SELECT * FROM Cache WHERE source='${sql_format_string(url)}' AND IP='${host}'`
				).then((rows: any[]) => {
					if(rows.length < 1) {
						HttpResponse.NotFound(res);
						return;
					}
					res.writeHead(200);
					res.end(fs.readFileSync(`./cache/${rows[0].location}`));
					return;
				}).catch(err => {console.log(err);HttpResponse.NotFound(res);});
			}
			HttpResponse.NotFound(res);
			return;
		}
		//console.log(`cache hit - ${url} - ${rows[0].location}`);
		res.writeHead(200);
		res.end(fs.readFileSync(`./cache/${rows[0].location}`));
	}).catch(err => {
		console.log(err);
	});
}

// Function to start WebSocket server and await until it's listening
const startWebSocketServer = (): Promise<WebSocket.AddressInfo> => {
    return new Promise((resolve, reject) => {
        const server = new WebSocket.WebSocketServer({ port: 0 }, () => {
            const address = server.address() as WebSocket.AddressInfo; // Type assertion to AddressInfo
            resolve(address);  // Resolve the Promise when server starts listening
        });

        // Handle error case
        server.on('error', (err) => {
            reject(err);  // Reject the Promise if an error occurs
        });

        // Handle connection events
        server.on('connection', (ws: WebSocket.WebSocket) => {
            DashboardClient = ws;
			ws.on('error', console.error); 
			ws.on('message', function message(data) {
				console.log('dashboard client message', data);
			});
        });
    });
};

export async function shutdown() {
	await log.write({
		Action: "shutdown",
		Type: "user-command",
		Message: "bot backend shutting down"
	});
	await CloseWebSockets();
	await Discord.DisconnectGateway();
	//close out client connection, this signals that the server has shut down
	DashboardClient?.close(1000);
	process.exit(0);
}

async function ResolveRequestFromAuthorizedIP(req: http.IncomingMessage, res: http.ServerResponse) {
	let bodydata = '';
	let body: any;
	
	// Listen for data chunks
	req.on('data', (chunk) => {
		bodydata += chunk;
	});
	// When all data has been received
	req.on('end', () => {
		try {
			body = JSON.parse(bodydata); // Parse if JSON is expected
			//console.log('Received body:', body);
		} catch (error) {
		}
	});
	//.
	//.	dashboard page
	//.
	if(req.url == '/dashboard') {
		res.setHeader("Content-Type", "text/html");
		res.writeHead(200);
		res.end(GetDirectoryPage('./web/dashboard'));
		return;
	}
	//.
	//. react out
	//.
	else if(req.url?.startsWith('/react-out')) {
		const UrlComponents = req.url.split('/');
		const url = '/web/'+UrlComponents[2]+'/build/'+UrlComponents.slice(3).join('/');
		console.log(`serving url - ${req.url} - ${url}`);
		return await ServeFile(url,res);
	}
	//.
	//. sockets
	//.
	else if(req.url == '/sockets') {
		if(req.method == 'GET') {
			var data: Array<Types.HTTP.Socket> = [
				{
					Name: "Discord Gateway Connection",
					ConnectTime: 0,
					Url: Discord.GatewayClient != undefined ? Discord.GatewayClient.url : "undefined",
					status: Discord.GatewayClient != undefined ? Discord.GatewayClient.readyState : 5
				},
				{
					Name: "Twitch Bot User WebSocket Connection",
					ConnectTime: 0,
					Url: WebsocketClient_BotUser != undefined ? WebsocketClient_BotUser.url : "undefined",
					status: WebsocketClient_BotUser != undefined ? WebsocketClient_BotUser.readyState : 5
				},
				{
					Name: "Twitch Broadcaster WebSocket Connection",
					ConnectTime: 0,
					Url: WebsocketClient_Broadcaster != undefined ? WebsocketClient_Broadcaster.url : "undefined",
					status: WebsocketClient_Broadcaster != undefined ? WebsocketClient_Broadcaster.readyState : 5
				}
			];
			return HttpResponse.OK.json(res,data);
		}
		return;
	}
	//.
	//. logs
	//.
	else if(req.url == '/logs') {
		if(req.method == 'GET') {
			let data: any[] = await db.query(
				`SELECT * FROM Log`
			).then((rows: any[]) => {return rows;}).catch(err => {console.log(err);return [];});
			return HttpResponse.OK.json(res,data);
		}
		return HttpResponse.InvalidMethod(res);
	}
	//.
	//. connect
	//.
	else if(req.url == '/connect') {
		const address = await startWebSocketServer();
        console.log(`WebSocket server is listening on port ${address.port}`);
		let data = {
			host: host,
			port: address.port,
			ConnectAfter: 250
		};
		return HttpResponse.OK.json(res,data);
	}
	//.
	//. cache
	//.
	else if(req.url?.startsWith('/cache/')) {
		return await ResolveCache(req.url.substring(7),res);
	}
	//.
	//. shutdown
	//.
	else if(req.url?.startsWith('/shutdown')) {
		console.log("server shutting down...");
		shutdown();
		return HttpResponse.OK.json(res,{
			shutdown: true
		});
	}
	//.
	//. API message page
	//.
	else if(req.url?.startsWith('/APIMessage/')) {
		const id = req.url.replace('/APIMessage/','');
		const rows: any[] | undefined = await db.query(
			`SELECT * FROM APIMessages WHERE ID='${id}'`
		).catch(err => {
			console.log("database error:",err);
			return undefined;
		});
		if(rows != undefined) {
			if(rows.length > 0) {
				res.setHeader("Content-Type", "text/html");
				res.writeHead(200);
				res.end(GetDirectoryPage('./web/APIMessage',{
					response: rows[0].Header,
					body: rows[0].Content,
				}));
				return;
			}
		}
	}
	//.
	//. run function
	//.
	else if(req.url?.startsWith('/function/')) {
		const id = req.url.replace('/function/','');
		try {
			switch(id) {
				case('SendTwitchRedemptionNotification'): {
					Discord.SendTwitchRedemptionNotification(body.User,body.Action);
					break;
				}
				default:
					return HttpResponse.NotFound(res);
			}
		} catch(error: any) {
			res.setHeader("Content-Type", "text/html");
			res.writeHead(422);
			res.end(GetStatusPage(422,`${error}`));
		}
		return HttpResponse.OK.json(res,{});
	}
	return HttpResponse.NotFound(res);
}

const requestListener = async function (req: http.IncomingMessage, res: http.ServerResponse) {
	console.log(`request: ${req.socket.remoteAddress} - ${req.url} - ${req.method}`);
	if(req.socket.remoteAddress == '192.168.178.101') return await ResolveRequestFromAuthorizedIP(req,res);
	if(req.socket.remoteAddress == host) return await ResolveRequestFromAuthorizedIP(req,res);
	console.log("ip not authorized:",req.socket.remoteAddress);
	return HttpResponse.Unauthorized(res);
};

export namespace HttpServer {
	var server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
	export async function Start() {
		server = http.createServer(requestListener);
		server.listen(port, host, () => {
			console.log(`Server is running on http://${host}:${port}`);
		});
	}
}
