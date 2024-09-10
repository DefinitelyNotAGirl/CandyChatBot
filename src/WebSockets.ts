import WebSocket from 'ws';
import { BotUserAccessToken, BotUserID, BroadcasterAccessToken, ChannelUserID, EVENTSUB_WEBSOCKET_URL, RefreshBotUserAccessToken, RefreshBroadcasterAccessToken, ValidateBotUserAccessToken, ValidateBroadcasterAccessToken } from './Database.js';
import * as Request from './Requests.js';
import { OnTwitchChatMessage, OnTwitchFollow, OnTwitchAutomodHold, OnTwitchAdBreakBegin, OnTwitchSub, OnTwitchChannelpointsRedemption, OnTwitchChannelUpdate } from './bot.js';
import { Types } from './Types.js'
import { log } from './logging.js';

var websocketSessionID_BotUser: string;
var websocketSessionID_Broadcaster: string;
//.
//. EventSub Listener
//.
function startWebSocketClient_BotUser() {
	let websocketClient = new WebSocket(EVENTSUB_WEBSOCKET_URL);
	websocketClient.on('error', console.error);
	websocketClient.on('open', () => {
		console.log('WebSocket connection opened to ' + EVENTSUB_WEBSOCKET_URL);
		log.connect_url(websocketClient.url);
	});
	websocketClient.on('message', (data) => {
		handleWebSocketMessage_BotUser(JSON.parse(data.toString()));
	});
	return websocketClient;
}
function startWebSocketClient_Broadcaster() {
	let websocketClient = new WebSocket(EVENTSUB_WEBSOCKET_URL);
	websocketClient.on('error', console.error);
	websocketClient.on('open', () => {
		console.log('WebSocket connection opened to ' + EVENTSUB_WEBSOCKET_URL);
		log.connect_url(websocketClient.url);
	});
	websocketClient.on('message', (data) => {
		handleWebSocketMessage_Broadcaster(JSON.parse(data.toString()));
	});
	return websocketClient;
}
export var WebsocketClient_BotUser: WebSocket;
export var WebsocketClient_Broadcaster: WebSocket;
export async function StartWebSockets() {
	if((await ValidateBotUserAccessToken()).status == 401)
		await RefreshBotUserAccessToken();
	if((await ValidateBroadcasterAccessToken()).status == 401)
		await RefreshBroadcasterAccessToken();
	WebsocketClient_BotUser = startWebSocketClient_BotUser();
	WebsocketClient_Broadcaster = startWebSocketClient_Broadcaster();
}
export async function CloseWebSockets() {
	let response = await Request.Twitch.Synchronous(
		`https://api.twitch.tv/helix/eventsub/subscriptions`,{
			method: 'GET',
		},BotUserAccessToken
	);
	let bj: any = await response.json();
	let body: Types.Twitch.EventSub.Subscriptions = bj;
	for(let i = 0;i<body.data.length;i++) {
		let sub = body.data[i];
		await DeleteEventSubListener_BotUser(sub.id,sub.type);
	}
	WebsocketClient_BotUser.close(1000);
	response = await Request.Twitch.Synchronous(
		`https://api.twitch.tv/helix/eventsub/subscriptions`,{
			method: 'GET',
		},BroadcasterAccessToken
	);
	bj = await response.json();
	body = bj;
	for(let i = 0;i<body.data.length;i++) {
		let sub = body.data[i];
		await DeleteEventSubListener_BotUser(sub.id,sub.type);
	}
	WebsocketClient_Broadcaster.close(1000);
}
//.
//. EventSub Message Received
//.
function handleWebSocketMessage_BotUser(data: any) {
	switch (data.metadata.message_type) {
		case 'session_welcome': // First message you get from the WebSocket server when connecting
			Request.Database.AddAPIMessage(`<websocket message - ${data.metadata.message_type}>`,JSON.stringify(data));
			websocketSessionID_BotUser = data.payload.session.id; // Register the Session ID it gives us
			// Listen to EventSub, which joins the chatroom from your bot's account
			registerEventSubListeners_BotUser();
			Request.Twitch.SendChatMessage("beep boop, bot has joined");
			break;
		case 'session_reconnect': // client must reconnect to a different server, server will close old connection with code 4004
			Request.Database.AddAPIMessage(`<websocket message - ${data.metadata.message_type}>`,JSON.stringify(data));
			websocketSessionID_BotUser = data.payload.session.id; // Register the Session ID it gives us
			WebsocketClient_BotUser = new WebSocket(data.payload.session.reconnect_url);
			WebsocketClient_BotUser.on('error', console.error);
			WebsocketClient_BotUser.on('open', () => {
				console.log('WebSocket reconnected');
			});
			WebsocketClient_BotUser.on('message', (data) => {
				handleWebSocketMessage_BotUser(JSON.parse(data.toString()));
			});
			break;
		case 'session_keepalive':
			break;
		case 'notification': // An EventSub notification has occurred, such as channel.chat.message
			Request.Database.AddAPIMessage(`<websocket message - ${data.metadata.message_type}>`,JSON.stringify(data));
			switch (data.metadata.subscription_type) {
				case 'channel.chat.message':
					OnTwitchChatMessage(data);
					break;
				case 'channel.follow':
					OnTwitchFollow(data);
					break;
				case 'automod.message.hold':
					OnTwitchAutomodHold(data);
					break;
				case 'channel.update':
					OnTwitchChannelUpdate(data.event);
					break;
			}
			break;
		default:
			Request.Database.AddAPIMessage(`<websocket message - UNKNOWN - ${data.metadata.message_type}>`,JSON.stringify(data),true);
	}
}
//.
//. EventSub Message Receiver
//.
function handleWebSocketMessage_Broadcaster(data: any) {
	switch (data.metadata.message_type) {
		case 'session_welcome': // First message you get from the WebSocket server when connecting
			Request.Database.AddAPIMessage(`<websocket message - ${data.metadata.message_type}>`,JSON.stringify(data));
			websocketSessionID_Broadcaster = data.payload.session.id; // Register the Session ID it gives us
			// Listen to EventSub, which joins the chatroom from your bot's account
			registerEventSubListeners_Broadcaster();
			break;
		case 'session_reconnect': // client must reconnect to a different server, server will close old connection with code 4004
			Request.Database.AddAPIMessage(`<websocket message - ${data.metadata.message_type}>`,JSON.stringify(data));
			websocketSessionID_Broadcaster = data.payload.session.id; // Register the Session ID it gives us
			WebsocketClient_Broadcaster = new WebSocket(data.payload.session.reconnect_url);
			WebsocketClient_Broadcaster.on('error', console.error);
			WebsocketClient_Broadcaster.on('open', () => {
				console.log('WebSocket reconnected');
			});
			WebsocketClient_Broadcaster.on('message', (data) => {
				handleWebSocketMessage_Broadcaster(JSON.parse(data.toString()));
			});
			break;
		case 'session_keepalive':
			break;
		case 'notification': // An EventSub notification has occurred, such as channel.chat.message
			Request.Database.AddAPIMessage(`<websocket message - ${data.metadata.message_type}>`,JSON.stringify(data));
			switch (data.metadata.subscription_type) {
				case 'channel.ad_break.begin':
					OnTwitchAdBreakBegin(data);
					break;
				case 'channel.subscribe':
					OnTwitchSub(data);
					break;
				case 'channel.channel_points_custom_reward_redemption.add':
					OnTwitchChannelpointsRedemption(data.payload.event);
					break;
			}
			break;
		default:
			Request.Database.AddAPIMessage(`<websocket message - UNKNOWN - ${data.metadata.message_type}>`,JSON.stringify(data),true);
	}
}
//.
//. Register Event Listeners
//.
async function RegisterEventSubListener_BotUser(Condition: any,Version: string,Type: string) {
	let response = await Request.Twitch.Synchronous(
		'https://api.twitch.tv/helix/eventsub/subscriptions',{
			method: 'POST',
			body: JSON.stringify({
				type: Type,
				version: Version,
				condition: Condition,
				transport: {
					method: 'websocket',
					session_id: websocketSessionID_BotUser
				}
			})
		},BotUserAccessToken
	);
	let data = await response.json();
	Request.Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(data));
	//console.log(`EventSub ${Type} API call response:`,response,`response body:`,data);
	if(response.status == 409) {
		return;
	}
	if (response.status != 202) {
		console.error(`\x1b[31mFailed to subscribe to ${Type}\x1b[0m`);
		process.exit(1);
	} else {
		console.error(`\x1b[32msubscribed to ${Type}\x1b[0m`);
	}
}
async function RegisterEventSubListener_Broadcaster(Condition: any,Version: string,Type: string) {
	let response = await Request.Twitch.Synchronous(
		'https://api.twitch.tv/helix/eventsub/subscriptions',{
			method: 'POST',
			body: JSON.stringify({
				type: Type,
				version: Version,
				condition: Condition,
				transport: {
					method: 'websocket',
					session_id: websocketSessionID_Broadcaster
				}
			})
		},BroadcasterAccessToken,
	);
	let data = await response.json();
	Request.Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(data));
	//console.log(`EventSub ${Type} API call response:`,response,`response body:`,data);
	if(response.status == 409) {
		return;
	}
	if (response.status != 202) {
		console.error(`\x1b[31mFailed to subscribe to ${Type}\x1b[0m`);
		process.exit(1);
	} else {
		console.error(`\x1b[32msubscribed to ${Type}\x1b[0m`);
	}
}
async function DeleteEventSubListener_Broadcaster(id: string,type: string) {
	let response = await Request.Twitch.Synchronous(
		`https://api.twitch.tv/helix/eventsub/subscriptions?id=${id}`,{
			method: 'DELETE',
		},BroadcasterAccessToken,
	);
	console.error(`\x1b[32munsubscribed from ${type}\x1b[0m`);
}
async function DeleteEventSubListener_BotUser(id: string,type: string) {
	let response = await Request.Twitch.Synchronous(
		`https://api.twitch.tv/helix/eventsub/subscriptions?id=${id}`,{
			method: 'DELETE',
		},BotUserAccessToken,
	);
	console.error(`\x1b[32munsubscribed from ${type}\x1b[0m`);
}
async function registerEventSubListeners_BotUser(): Promise<void> {
	RegisterEventSubListener_BotUser(
		/* condition */ {
			broadcaster_user_id: ChannelUserID,
			user_id: BotUserID
		},
		'1',
		'channel.chat.message'
	);
	RegisterEventSubListener_BotUser(
		/* condition */ {
			broadcaster_user_id: ChannelUserID,
			moderator_user_id: BotUserID
		},
		'2',
		'channel.follow'
	);
	RegisterEventSubListener_BotUser(
		/* condition */ {
			broadcaster_user_id: ChannelUserID,
			moderator_user_id: BotUserID
		},
		'1',
		'automod.message.hold'
	);
	RegisterEventSubListener_BotUser(
		/* condition */ {
			broadcaster_user_id: ChannelUserID,
		},
		'2',
		'channel.update'
	);
}
async function registerEventSubListeners_Broadcaster(): Promise<void> {
	RegisterEventSubListener_Broadcaster(
		/* condition */ {
			broadcaster_user_id: ChannelUserID,
		},
		'1',
		'channel.ad_break.begin'
	);
	RegisterEventSubListener_Broadcaster(
		/* condition */ {
			broadcaster_user_id: ChannelUserID,
		},
		'1',
		'channel.subscribe'
	);
	RegisterEventSubListener_Broadcaster(
		/* condition */ {
			broadcaster_user_id: ChannelUserID,
		},
		'1',
		'channel.channel_points_custom_reward_redemption.add'
	);
}