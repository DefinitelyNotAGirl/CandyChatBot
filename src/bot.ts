import { Types } from './Types.js'
import * as Request from './Requests.js';
import { ValidateBotUserAccessToken, RefreshBotUserAccessToken, EVENTSUB_WEBSOCKET_URL, BotUserAccessToken, ChannelUserID, BotUserID, BroadcasterAccessToken, db, BotBootTimestamp, MasterLoginName, ValidateBroadcasterAccessToken, RefreshBroadcasterAccessToken, LoadTokens, LoadSettings, RunCheapViewerBotCheck, RunLinkCheck, TwitchAutomodAutoRelease, ChangeBroadcaster, TwitchRewardIDs, StartTwitchBot, StartDiscordBot, StartHttpServer } from './Database.js';
import { CloseWebSockets, StartWebSockets } from './WebSockets.js';
import { AddMesageToDatabase, deaccent, IncrementUserWatchtime, MillisecondsToDurationString, sql_format_string, TimeDifference } from './util.js';
import { Discord } from './discord.js';
import { HttpServer, SendDashboardMessage, shutdown } from './WebServer.js';
import { log } from './logging.js';
import path from 'path';

process.title = "CandyInspector";
//.
//.	load settings
//.
await LoadTokens();
await LoadSettings();

//.
//. start http server
//.
if(StartHttpServer) {
	console.log("starting http server...");
	Request.Database.DebugLog('start','starting http server...');
	HttpServer.Start();
}
//.
//. start twitch bot
//.
if(StartTwitchBot) {
	console.log("starting twitch bot...");
	await StartWebSockets();
	await UpdateState();
}
//.
//. start discord bot
//.
if(StartDiscordBot) {
	console.log("starting discord bot...");
	Request.Database.DebugLog('start','starting discord bot...');
	await Discord.LoadSettings();
	await Discord.ConnectGateway();
}
//+
//+ Twitch Watchtime
//+
async function IncrementWatchtime(cursor: string | undefined = undefined) {
	let page = "";
	if(cursor != undefined) {
		page = `&after=${cursor}`;
	}
	let response = await Request.Twitch.Synchronous(
		`https://api.twitch.tv/helix/chat/chatters?broadcaster_id=${ChannelUserID}&moderator_id=${BotUserID}&first=1000${page}`, {
			method: "GET",
		},BotUserAccessToken
	);
	let body: any = await response.json();
	Request.Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(body));
	//console.log("chatters body:",body);
	for(let i = 0;i<body.data.length;i++) {
		let user = body.data[i];
		IncrementUserWatchtime("twitch-"+user.user_login);
	}
	if(body.pagination.cursor != undefined) {
		IncrementWatchtime(body.pagination.cursor);
	}
}
IncrementWatchtime();
setInterval(() => {
	IncrementWatchtime();
},(5*60*1000));
//.
//. check if user is allowed to send links
//.
async function HasLinkPermission(chatter_login: string,broadcaster_login:string,message: Types.Twitch.Event.ChatMessage) {
	if(chatter_login == broadcaster_login) {
		return true;
	}
	if(message.badges != undefined) {
		for(let i = 0;i<message.badges.length;i++) {
			let badge = message.badges[i];
			if(badge.set_id == "moderator") {
				return true;
			}
			if(badge.set_id == "vip") {
				return true;
			}
			//if(badge.set_id == "subscriber") {
			//	return true;
			//}
		}
	}
	var result = await db.query(
		`SELECT * FROM Users WHERE UserID='twitch-${chatter_login}'`
	).then(
		(rows: any) => {
			//console.log(rows);
			//console.log(res);
			if(rows.length < 1) {
				db.query(
					`INSERT INTO Users (UserID) VALUES ('twitch-${chatter_login}')`
				).then((rows) => {console.log(rows);}).then((res) => {/*console.log(res);*/}).catch(err => {console.log(err);});
				return false;
			} else {
				return rows[0].Links;
			}
		}
	).catch(err => {console.log(err);});
	return result;
}
//.
//. check if user is exempt from message checks
//.
async function HasBadMessagePermission(chatter_login: string,broadcaster_login: string,message: Types.Twitch.Event.ChatMessage) {
	//console.log("message event:",message);
	if(chatter_login == broadcaster_login) {
		return true;
	}
	if(message.badges != undefined) {
		for(let i = 0;i<message.badges.length;i++) {
			let badge = message.badges[i];
			if(badge.set_id == "moderator") {
				return true;
			}
			if(badge.set_id == "vip") {
				return true;
			}
			//if(badge.set_id == "subscriber") {
			//	return true;
			//}
		}
	}
	var result = await db.query(
		`SELECT * FROM Users WHERE UserID='twitch-${chatter_login}'`
	).then(
		(rows: any) => {
			//console.log(rows);
			if(rows.length < 1) {
				db.query(
					`INSERT INTO Users (UserID) VALUES ('twitch-${chatter_login}')`
				).then((rows) => {console.log(rows);}).then((res) => {/*console.log(res);*/}).catch(err => {console.log(err);});
				return false;
			} else {
				return rows[0].BadMessage;
			}
		}
	).catch(err => {console.log(err);});
	return result;
}
//,
//, check for bad message content
//,
async function RunBadMessageCheck(data: any,message: Types.Twitch.Event.ChatMessage) {
	//console.log("message event:",data.payload.event);
	var deaccented = deaccent(data.payload.event.message.text.trim().toLowerCase());
	if(RunCheapViewerBotCheck) {
		//console.log("deaccent:",deaccented);
		if(deaccented.includes("cheap viewers on")) {
			Request.Twitch.deleteMessage(message);
			Request.Twitch.BanUser(message.chatter_user_id,message.broadcaster_user_id,"spam bot - CandyInspector");
			return;
		}
		if(deaccented.includes("best viewers on")) {
			Request.Twitch.deleteMessage(message);
			Request.Twitch.BanUser(message.chatter_user_id,message.broadcaster_user_id,"spam bot - CandyInspector");
			return;
		}
	}
	if(!(await HasLinkPermission(data.payload.event.chatter_user_login,data.payload.event.broadcaster_user_login,message)) && RunLinkCheck) {
		var RegexResults = RegExp("(((http)|(https)|(ftp))://)|([a-zA-Z0-9_]*\\.[a-zA-Z]{2,})").exec(deaccented);
		if(RegexResults != null) {
			//console.log("regex results:",RegexResults)
			for(let i = 0;i<RegexResults.length-1;i++) {
				var match = RegexResults.at(i);
				if(match == undefined)continue;
				//console.log("match:",match);
				if(match == "twitch.tv")continue;
				Request.Twitch.deleteMessage(message);
				if((await Request.Database.GetMessageCount(message.chatter_user_login)) > 1) {
					Request.Twitch.SendChatMessage(`no links please @${message.chatter_user_name}.`);
				}
				break;
			}
		}
	}
}
//,
//, $ci
//,
async function CICommand(message: Types.Twitch.Event.ChatMessage) {
	var text = message.message.text;
	var tokens = text.split(' ');
	if(tokens.length < 3) {
		Request.Twitch.SendChatMessage(`insufficient number of arguments @${message.chatter_user_name}`);
		return;
	}
	if(tokens[1] == 'set') {
		if(tokens.length < 4) {
			Request.Twitch.SendChatMessage(`insufficient number of arguments @${message.chatter_user_name}`);
			return;
		}
		let target = tokens[2];
		let value = tokens[3];
		Request.Database.UpdateSetting(target,value);
	} else if(tokens[1] == 'get') {
		let target = tokens[2];
		let value = await Request.Database.GetSetting(target);
		Request.Twitch.SendChatMessage(`value of '${target}' is '${value}' @${message.chatter_user_name}`);
	} else if(tokens[1] == 'chat') {	
		let target = tokens[2];
		Request.Twitch.SendChatMessage(`bot is switching broadcaster...`);
		ChangeBroadcaster(target);
	} else {
		Request.Twitch.SendChatMessage(`unknown primary command '${tokens[1]}' @${message.chatter_user_name}`);
		return;
	}
}
//,
//, Twitch Chat Message Event
//,
export async function OnTwitchChatMessage(data: any) {
	var message: Types.Twitch.Event.ChatMessage = data.payload.event;
	var text = message.message.text;
	console.log(`\x1b[31m${data.payload.event.broadcaster_user_login}\x1b[0m \x1b[32m${data.payload.event.chatter_user_login}\x1b[0m ${data.payload.event.message.text}`);
	SendDashboardMessage({
		type: "twitch-chat",
		object: message
	});
	AddMesageToDatabase("twitch-"+message.chatter_user_login,message.chatter_user_name,"twitch-"+message.message_id,message.message.text);
	if(!(await HasBadMessagePermission(message.chatter_user_login,message.broadcaster_user_login,message))) {
		RunBadMessageCheck(data,message);
	}
	if(text.startsWith("!beepboop")) {
		Request.Twitch.SendChatMessage(`beep boop. bot uptime: ${TimeDifference(BotBootTimestamp,Date.now())} @definitelynotagirl1151`);
	} else if(text.startsWith("!watchtime")) {
		let target_login = message.chatter_user_login;
		if(text.length > ("!watchtime").length)
			target_login = text.substring(("!watchtime").length+1);
		await db.query(
			`SELECT * FROM Users WHERE UserID='twitch-${target_login}'`
		).then(
			(rows: any[]) => {
				//console.log(rows);
				if(rows.length < 1) {
					db.query(
						`INSERT INTO Users (UserID) VALUES ('twitch-${target_login}')`
					).then((rows) => {console.log(rows);}).then((res) => {/*console.log(res);*/}).catch(err => {console.log(err);});
					Request.Twitch.SendChatMessage(`no watchtime on record for ${target_login}. @${message.chatter_user_name}`);
				} else {
					Request.Twitch.SendChatMessage(`${target_login}'s watchtime is ${MillisecondsToDurationString(rows[0].Watchtime*1000)} @${message.chatter_user_name}`);
				}
			}
		).catch(err => {console.log(err);});
	} else if(text.startsWith("!vip")) {
		//if(message.chatter_user_login == MasterLoginName) {
		//	let target_login = text.substring(("!vip").length+1);
		//	let TargetInfo = await Request.Twitch.GetTwitchUserInfo(target_login);
		//	Request.Twitch.AddVIP(TargetInfo.id,message.broadcaster_user_id);
		//}
	} else if(text.startsWith("!botkill")) {
		if((message.chatter_user_login == MasterLoginName) || (message.chatter_user_login == message.broadcaster_user_login)) {
			await Request.Twitch.SendChatMessage(`boop beep, bot killed @${message.chatter_user_name}`);
			shutdown();
		}
	} else if(text.startsWith("!messagecount")) {
		let target_login = message.chatter_user_login;
		if(text.length > ("!messagecount").length)
			target_login = text.substring(("!messagecount").length+1);
		let MessageCount = await Request.Database.GetMessageCount(`twitch-${target_login}`);
		Request.Twitch.SendChatMessage(`${target_login} has sent ${MessageCount} messages in this chat room. @${message.chatter_user_name}`);
	} else if(text.startsWith("!commands")  || text.startsWith("!help")) {
		Request.Twitch.SendChatMessage(`
			available commands ///
			!help ///
			!commands ///
			!watchtime ///
			!vip (L0 Privilege) ///
			!botkill (L1 Privilege) ///
			!messagecount ///
			!beepboop ///
			@${message.chatter_user_name}`
		);
	} else if(text.startsWith("$ci")) {
		if((message.chatter_user_login == MasterLoginName) || (message.chatter_user_login == message.broadcaster_user_login)) {
			CICommand(message);
		}
	}
}
//,
//, Twitch Follow Event
//,
export async function OnTwitchFollow(data: any) {
	let event = data.payload.event;
	console.log(`\x1b[31m${event.broadcaster_user_name}\x1b[34m follow \x1b[32m${event.user_name}\x1b[0m`);
}
//,
//, Twitch Sub Event
//,
export async function OnTwitchSub(data: any) {
	let event = data.payload.event;
	console.log(`\x1b[31m${event.broadcaster_user_name}\x1b[34m subscribe \x1b[32m${event.user_name}\x1b[0m`);
}
//,
//, Twitch Ad Break
//,
export async function OnTwitchAdBreakBegin(data: any) {
	let event = data.payload.event;
	Request.Twitch.SendChatMessage(`Ad-Break: ${MillisecondsToDurationString(event.duration_seconds*1000)} @${event.broadcaster_user_name}`);
	setTimeout(() => {
		Request.Twitch.SendChatMessage(`Ad-Break over. @${event.broadcaster_user_name}`);
	}, event.duration_seconds*1000);
}
//,
//, Twitch Automod hold event
//,
export async function OnTwitchAutomodHold(data: any) {
	let event = data.payload.event;
	console.log(`\x1b[31m${event.broadcaster_user_name}\x1b[34m automod hold \x1b[32m${event.user_name} \x1b[0m ${event.message}`);
	if(TwitchAutomodAutoRelease) {
		if(await HasBadMessagePermission(event.user_login,event.broadcaster_user_login,new Types.Twitch.Event.ChatMessage)) {
			Request.Twitch.AutomodRelease(event.message_id);
		}
	}
}
//,
//, Twitch channel points redemption
//,
export async function OnTwitchChannelpointsRedemption(event: Types.Twitch.Event.ChannelPointsRedemption) {
	if(event.reward.type != undefined) {
		//+ automatic reward
		console.log(`\x1b[31m${event.broadcaster_user_name}\x1b[34m redemption\x1b[33m ${event.reward.type}\x1b[32m ${event.user_name}\x1b[0m`);
	} else if(event.reward.title != undefined) {
		//+ custom reward
		console.log(`\x1b[31m${event.broadcaster_user_name}\x1b[34m redemption\x1b[33m ${event.reward.title}\x1b[32m ${event.user_name}\x1b[0m`);
		if(!event.reward.id) {
		} else if(event.reward.id == TwitchRewardIDs.VIP) {
			Request.Twitch.AddVIP(event.user_id,event.broadcaster_user_id);
			Request.Twitch.CompleteCustomReward(event);
		} else if (
			(event.reward.id == TwitchRewardIDs.Hydrate)
			|| (event.reward.id == TwitchRewardIDs.PostureCheck)
			|| (event.reward.id == TwitchRewardIDs.Stretch)
		) {
			setTimeout(() => {
				Request.Twitch.CompleteCustomReward(event);
			}, 1000*5*60);
		} else {
			const rows: Array<{
				ID: number,
				Games: string,
				Title: string,
				IsGameSpecific: Boolean,
				Description: string,
				Background: string,
				Icon: string,
				RewardID: string,
				cost: number,
				Function: string
			}> = await db.query(
				`SELECT * FROM Rewards WHERE RewardID='${sql_format_string(event.reward.id)}'`
			).catch(err => {console.log(err);});
			if(rows.length == 0 || rows[0].Function == 'NONE') {
				const DiscordMessageID = await Discord.SendTwitchRedemptionNotification(event.user_name,event.reward.title);
				await db.query(
					`INSERT INTO Redemptions (RedemptionID,DiscordMessageID,Platform,RewardID) VALUES ('${sql_format_string(event.id)}','${sql_format_string(DiscordMessageID)}','Twitch','${sql_format_string(event.reward.id)}')`
				).then((rows: any[]) => {}).catch(err => {console.log(err);});
			} else {
				const filePath = path.resolve(__dirname, 'Rewards',rows[0].Function,'build','main.js');
				const newCode = require(filePath);  // This will execute the file when required
				// Assuming the required file exports a function
				newCode.run(event);
			}

		}
	}
}
//,
//, Twitch channel update event
//,
export async function OnTwitchChannelUpdate(event: Types.Twitch.Event.ChannelUpdate) {
	UpdateGame(event.category_name);
}
//+
//+ create game specific reward
//+
async function CreateGameSpecificReward(Reward: Types.Database.Reward): Promise<number> {
	if(Reward.RewardID != null) return 204;
	let response = await Request.Twitch.Synchronous(
		`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${ChannelUserID}`, {
			method: "POST",
			body: JSON.stringify({
				title: Reward.Title,
				cost: Reward.cost,
				background_color: Reward.Background
			})
		},BroadcasterAccessToken
	);
	if(response.status == 400) return response.status;
	let bj: any = await response.json();
	console.log("reward create response:",response);
	console.log("reward create response body:",bj);
	await db.query(
		`UPDATE Rewards SET RewardID='${bj.id}' WHERE ID='${Reward.ID}'`
	).then((rows: any[]) => {console.log(rows);}).catch(err => {console.log(err);});
	return response.status;
}
//+
//+ delete game specific reward
//+
async function DeleteGameSpecificReward(Reward: Types.Database.Reward): Promise<number> {
	if(Reward.RewardID == null) return 204;
	let response = await Request.Twitch.Synchronous(
		`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${ChannelUserID}&id=${Reward.RewardID}`, {
			method: "DELETE"
		},BroadcasterAccessToken
	);
	if(response.status == 400) return response.status;
	let bj: any = await response.json();
	console.log("reward delete response:",response);
	console.log("reward delete response body:",bj);
	await db.query(
		`UPDATE Rewards SET RewardID=NULL WHERE ID='${Reward.ID}'`
	).then((rows: any[]) => {console.log(rows);}).catch(err => {console.log(err);});
	return response.status;
}
//.
//. Update game
//.
async function UpdateGame(name: string) {
	console.log(`update game: ${name}`);
	await db.query(
		`SELECT * FROM Rewards`
	).then((rows: Array<Types.Database.Reward>) => {
		console.log(rows);
		for (let index = 0; index < rows.length; index++) {
			const Reward = rows[index];
			if(Reward.IsGameSpecific == 0)continue;
			const Games: string[] = Reward.Games.split('¿');
			console.log("Games",Games);
			if(Games.includes(name)) {
				CreateGameSpecificReward(Reward);
			} else {
				DeleteGameSpecificReward(Reward);
			}
		}
	}).catch(err => {console.log(err);});
}
//+
//+ update state
//+
export async function UpdateState() {
	UpdateGame(((await Request.Twitch.GetChannelInfo(ChannelUserID)).game_name));
}
