import * as mariadb from 'mariadb';
import * as Request from './Requests.js'
import { CloseWebSockets, StartWebSockets } from './WebSockets.js';
import { UpdateState } from './bot.js';
import { log } from './logging.js';

//-
//- constants
//-
export const BotBootTimestamp = Date.now();

//-
//- URLs
//-
export const EVENTSUB_WEBSOCKET_URL = 'wss://eventsub.wss.twitch.tv/ws';

//-
//- database
//-
export var db!: mariadb.Connection;
await mariadb.createConnection({
	host: "192.168.178.102",
	user: "root",
	password: "ReallyStrongPassword1234",
	database: "CandyChatBot",
	port: 3306
}).then(connection => {
	db = connection;
}).catch(err => {
	//handle error
	console.log(err);
	db.end();
	process.exit(1);
});
//-
//- Settings
//-
export var BroadcasterDatabaseID: string;
export var BotUserID: string;
export var BotUserRefreshToken: string;
export var BotUserAccessToken: string;
export var ClientSecret: string;
export var ClientID: string;
export var BroadcasterAccessToken: string;
export var BroadcasterRefreshToken: string;
export var ChannelUserID: string;
export var MasterLoginName: string;
export var PostNewClips: Boolean;
export var RunCheapViewerBotCheck: Boolean;
export var RunLinkCheck: Boolean;
export var TwitchAutomodAutoRelease: Boolean;
export var StartHttpServer: Boolean;
export var StartTwitchBot: Boolean;
export var StartDiscordBot: Boolean;
export namespace TwitchRewardIDs {
	export var Hydrate: string;
	export var Stretch: string;
	export var PostureCheck: string;
	export var VIP: string;
}
export async function LoadTokens() {
	BroadcasterDatabaseID = await Request.Database.GetSetting(`BroadcasterDatabaseID`);
	BotUserID = await Request.Database.GetSetting(`BotUserID`); // This is the User ID of the chat bot
	BotUserRefreshToken = await Request.Database.GetSetting(`BotUserRefreshToken`);
	BotUserAccessToken = await Request.Database.GetSetting(`BotUserAccessToken`);
	ClientSecret = await Request.Database.GetSetting(`ClientSecret`);
	ClientID = await Request.Database.GetSetting(`ClientID`);
	BroadcasterAccessToken = await Request.Database.GetSetting(`BroadcasterAccessToken_`+BroadcasterDatabaseID);
	BroadcasterRefreshToken = await Request.Database.GetSetting(`BroadcasterRefreshToken_`+BroadcasterDatabaseID);
	ChannelUserID = await Request.Database.GetSetting(`ChannelUserID_`+BroadcasterDatabaseID);
}
export async function LoadSettings() {
	MasterLoginName = await Request.Database.GetSetting(`MasterLoginName`);
	PostNewClips = await Request.Database.GetBooleanSetting(`PostNewClips`);
	RunCheapViewerBotCheck = await Request.Database.GetBooleanSetting(`RunCheapViewerBotCheck`);
	RunLinkCheck = await Request.Database.GetBooleanSetting(`RunLinkCheck`);
	TwitchAutomodAutoRelease = await Request.Database.GetBooleanSetting(`TwitchAutomodAutoRelease`);
	TwitchRewardIDs.Hydrate = await Request.Database.GetSetting(`TwitchRewardIDs.Hydrate`);
	TwitchRewardIDs.Stretch = await Request.Database.GetSetting(`TwitchRewardIDs.Stretch`);
	TwitchRewardIDs.PostureCheck = await Request.Database.GetSetting(`TwitchRewardIDs.PostureCheck`);
	TwitchRewardIDs.VIP = await Request.Database.GetSetting(`TwitchRewardIDs.VIP`);
	StartHttpServer = await Request.Database.GetBooleanSetting(`StartHttpServer`);
	StartTwitchBot = await Request.Database.GetBooleanSetting(`StartTwitchBot`);
	StartDiscordBot = await Request.Database.GetBooleanSetting(`StartDiscordBot`);
}
export async function ChangeBroadcaster(ID: string) {
	await CloseWebSockets();
	BroadcasterDatabaseID = ID;
	await Request.Database.UpdateSetting(`BroadcasterDatabaseID`,BroadcasterDatabaseID);
	BroadcasterAccessToken = await Request.Database.GetSetting(`BroadcasterAccessToken_`+BroadcasterDatabaseID);
	BroadcasterRefreshToken = await Request.Database.GetSetting(`BroadcasterRefreshToken_`+BroadcasterDatabaseID);
	ChannelUserID = await Request.Database.GetSetting(`ChannelUserID_`+BroadcasterDatabaseID);
	await StartWebSockets();
	await UpdateState();
}

//.
//.	validate bot user access token
//.
export async function ValidateBotUserAccessToken() {
	// https://dev.twitch.tv/docs/authentication/validate-tokens/#how-to-validate-a-token
	let response = await fetch('https://id.twitch.tv/oauth2/validate', {
		method: 'GET',
		headers: {
			'Authorization': 'OAuth ' + BotUserAccessToken
		}
	});
	Request.Database.AddAPIMessage(JSON.stringify(response),'');
	return response;
}
export async function RefreshBotUserAccessToken() {
	let RefreshResponse = await fetch(
		`https://id.twitch.tv/oauth2/token`, {
			method: "POST",
			headers: {
				'Authorization': 'Bearer ' + BotUserAccessToken,
				'Client-Id': ClientID,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				client_id: ClientID,
				client_secret: ClientSecret,
				grant_type: 'refresh_token',
				refresh_token: BotUserRefreshToken
			})
		}
	);
	console.log("refresh token response:",RefreshResponse);
	let RefreshData: any = await RefreshResponse.json();
	console.log("refresh token response body:",RefreshData);
	Request.Database.AddAPIMessage(JSON.stringify(RefreshResponse),JSON.stringify(RefreshData));
	if(RefreshResponse.status == 200) {
		BotUserAccessToken = RefreshData.access_token;
		BotUserRefreshToken = RefreshData.refresh_token;
		console.log("new bot user access token:",BotUserAccessToken);
		console.log("new bot user refresh token:",BotUserRefreshToken);
		await db.query(
			`UPDATE Settings SET Content='${BotUserAccessToken}' WHERE ID='BotUserAccessToken'`
		).then((rows) => {console.log(rows);}).then((res) => {/*console.log(res);*/}).catch(err => {console.log(err);});
		await db.query(
			`UPDATE Settings SET Content='${BotUserRefreshToken}' WHERE ID='BotUserRefreshToken'`
		).then((rows) => {console.log(rows);}).then((res) => {/*console.log(res);*/}).catch(err => {console.log(err);});
		log.refreshTokens('twitch');
		return;
	}
	process.exit(1);
}
//.
//.	validate broadcaster access token
//.
export async function ValidateBroadcasterAccessToken() {
	// https://dev.twitch.tv/docs/authentication/validate-tokens/#how-to-validate-a-token
	let response = await fetch('https://id.twitch.tv/oauth2/validate', {
		method: 'GET',
		headers: {
			'Authorization': 'OAuth ' + BroadcasterAccessToken
		}
	});
	Request.Database.AddAPIMessage(JSON.stringify(response),'');
	return response;
}
export async function RefreshBroadcasterAccessToken() {
	let RefreshResponse = await fetch(
		`https://id.twitch.tv/oauth2/token`, {
			method: "POST",
			headers: {
				'Authorization': 'Bearer ' + BroadcasterAccessToken,
				'Client-Id': ClientID,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				client_id: ClientID,
				client_secret: ClientSecret,
				grant_type: 'refresh_token',
				refresh_token: BroadcasterRefreshToken
			})
		}
	);
	console.log("refresh token response:",RefreshResponse);
	let RefreshData: any = await RefreshResponse.json();
	Request.Database.AddAPIMessage(JSON.stringify(RefreshResponse),JSON.stringify(RefreshData));
	console.log("refresh token response body:",RefreshData);
	if(RefreshResponse.status == 200) {
		BroadcasterAccessToken = RefreshData.access_token;
		BroadcasterRefreshToken = RefreshData.refresh_token;
		console.log("new broadcaster access token:",BroadcasterAccessToken);
		console.log("new broadcaster refresh token:",BroadcasterRefreshToken);
		await db.query(
			`UPDATE Settings SET Content='${BroadcasterAccessToken}' WHERE ID='${`BroadcasterAccessToken_`+BroadcasterDatabaseID}'`
		).then((rows) => {console.log(rows);}).then((res) => {/*console.log(res);*/}).catch(err => {console.log(err);});
		await db.query(
			`UPDATE Settings SET Content='${BroadcasterRefreshToken}' WHERE ID='${`BroadcasterRefreshToken_`+BroadcasterDatabaseID}'`
		).then((rows) => {console.log(rows);}).then((res) => {/*console.log(res);*/}).catch(err => {console.log(err);});
		return;
	}
	process.exit(1);
}
