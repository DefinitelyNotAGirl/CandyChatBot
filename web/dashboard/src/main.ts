import {Types} from 'Types';

export var PageInput: {
	ServerAddress: string;
	ServerPort: number;
};

async function LoadSockets() {
	const sockets = document.getElementById('sockets');
	let response = await fetch(
		`/sockets`, {
			method: "GET"
		}
	);
	const body: any = await response.json();
	const SocketArray: Array<Types.HTTP.Socket> = body; 
	if(sockets == null) {
		console.log("can't find sockets container");
		return;
	}
	for (let index = 0; index < SocketArray.length; index++) {
		const Socket: Types.HTTP.Socket = SocketArray[index];
		sockets.innerHTML += `
		<div class='socket' status='${Socket.status}'>
			<div class='status'></div>
			<div class='title'>${Socket.Name}</div>
			<div class='url'><span>endpoint:</span><span>${Socket.Url}</span></div>
			<div class='time'><span>connected for:</span><span>${Socket.ConnectTime}</span></div>
		</div>
		`;
	}
}

export type LogEntry = {
	ID: number
	Type: string
	Action: string
	Message: string
	Time: string
}

async function AddLogEntry(Entry: LogEntry) {
	const logs = document.getElementById('logs-table');
	if(logs == null) {
		console.log("can't find logs container");
		return;
	}
	logs.innerHTML = `
	<tr LogType='${Entry.Type}' LogAction='${Entry.Action}'>
		<td class='column_type material-symbols-rounded'></td>
		<td class='column_action material-symbols-rounded'></td>
		<td>${Entry.Message}</td>
		<td>${Entry.Time}</td>
	</tr>
	${logs.innerHTML}
	`;
	logs.scroll({
		behavior: "smooth",
		top: logs.scrollHeight
	});
}

async function AddTwitchChatMessage(message: Types.Twitch.Event.ChatMessage) {
	const chat = document.getElementById('chat');
	if(chat == null) {
		console.log("can't find chat container");
		return;
	}
	chat.innerHTML = `
	${chat.innerHTML}
	<div class='message'>
		${(() => {
			let badges = '';
			for (let index = 0; index < message.badges.length; index++) {
				const badge = message.badges[index];
				badges += `<img class='message-badge' src='/cache/CandyInspector/twitch-badge/${badge.set_id}/${badge.id}/1x' />`;
			}
			return badges;
		})()}
		<span class='message-user' style='color: ${message.color};'>${message.chatter_user_name}</span>
		<span class='message-text' >${message.message.text}</span>
	</div>
	`;
}

async function LoadLogs() {
	let response = await fetch(
		`/logs`, {
			method: "GET"
		}
	);
	const body: any = await response.json();
	const LogEntryArray: Array<LogEntry> = body;
	console.log("logs",LogEntryArray);
	for (let index = 0; index < LogEntryArray.length; index++) {
		AddLogEntry(LogEntryArray[index]);
	}
}

export async function ShutdownServer() {
	let response = await fetch(
		`/shutdown`, {
			method: "GET"
		}
	);
}
async function ConnectServer() {
	let response = await fetch(
		`/connect`, {
			method: "GET"
		}
	);
	const data: any = await response.json();
	const body: {
		host: string,
		port: number,
		ConnectAfter: number
	} = data;
	setTimeout(() => {
		var ServerConnection: WebSocket = new WebSocket(`ws://${body.host}:${body.port}`);
		ServerConnection.onerror = (error) => {
			console.error('WebSocket Error:', error);
		}
		ServerConnection.onopen = () => {
			console.log('dashboard connected to server');
		}
		ServerConnection.onmessage = (event: any) => {
			HandleServerMessage(JSON.parse(event.data.toString()));
		}
	}, body.ConnectAfter);
}

async function HandleServerMessage(event: Types.DashboardServerMessage) {
	if(event.type == "log") {
		if(event.object != undefined)
			AddLogEntry(event.object);
	}
	else if(event.type == "twitch-chat") {
		console.log("twitch chat message",event.object);
		if(event.object != undefined) {
			AddTwitchChatMessage(event.object);
		}
	}
}

export async function main() {
	console.log("main");
	LoadSockets();
	LoadLogs();
	ConnectServer();
}
