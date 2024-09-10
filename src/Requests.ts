import { BotUserAccessToken, BotUserID, BroadcasterAccessToken, ChannelUserID, ClientID, db, RefreshBotUserAccessToken, RefreshBroadcasterAccessToken, ValidateBotUserAccessToken, ValidateBroadcasterAccessToken } from './Database.js';
import { log } from './logging.js';
import { Types } from './Types.js'
import { sql_format_string } from './util.js';

export namespace Database {
	export async function AddAPIMessage(response: string,content: string, dolog: Boolean = false): Promise<number> {
		if(!dolog)return 0;
		await db.query(
			`INSERT INTO APIMessages (Content,Header) VALUES ('${content.replace("'","\\'")}','${response.replace("'","\\'")}');`
		).then((rows: any[]) => {console.log(rows);}).catch(err => {console.log(err);});
		return await db.query(
			`SELECT LAST_INSERT_ID();`
		).then((rows: any[]) => {return rows[0]['LAST_INSERT_ID()']}).catch(err => {console.log(err);return 0;});
	}

	export async function DebugLog(Action: string,Message: string) {
		await db.query(
			`INSERT INTO Log (Type,Action,Message) VALUES ('debug','${sql_format_string(Action)}','${sql_format_string(Message)}')`
		).then((rows: any[]) => {/*console.log(rows);*/}).catch(err => {console.log(err);});
	}

	export async function ActionLog(Action: string,Message: string) {
		await db.query(
			`INSERT INTO Log (Type,Action,Message) VALUES ('action','${sql_format_string(Action)}','${sql_format_string(Message)}')`
		).then((rows: any[]) => {/*console.log(rows);*/}).catch(err => {console.log(err);});
	}

	export async function GetSetting(ID: string): Promise<string> {
		return await db.query(
			`SELECT * FROM Settings WHERE ID='${ID}'`
		).then(
			(rows: any[]) => {
				//console.log(rows);
				if(rows.length > 0) {
					return rows[0].Content;
				}
				console.error(`ERROR: setting "${ID}" not found.`);
				return '';
			}
		).catch(err => {console.log(err);});
	}

	export async function GetMessageCount(UserID: string): Promise<number> {
		return await db.query(
			`SELECT * FROM ChatMessages WHERE UserID='${UserID}'`
		).then((rows: any[]) => {return rows.length;}).catch(err => {console.log(err);return 0;});
	}

	export async function GetBooleanSetting(ID: string): Promise<Boolean> {
		var result = await GetSetting(ID);
		if(result == "enabled")
			return true;
		if(result == "disabled")
			return false;
		return false;
	}

	export async function UpdateSetting(ID: string, Content: string): Promise<void> {
		await db.query(
			`UPDATE Settings SET Content='${Content}' WHERE ID='${ID}'`
		).then((rows: any[]) => {}).catch(err => {console.log(err);});
	}

	export function UpdateBooleanSetting(ID: string, Content: Boolean) {
		if(Content)
			UpdateSetting(ID,"enabled");
		else
			UpdateSetting(ID,"disabled");
	}
}

export namespace Twitch {
	/**
	 * @brief Synchronous API request
	 * @param input 
	 * @param init 
	 * @param AccessToken 
	 * @returns 
	 */
	export async function Synchronous(input: string, init: any, AccessToken: string) {
		if(init.headers != undefined) {
			console.log("warning: API request headers overwrite");
		}
		init.headers = {
			'Authorization': 'Bearer ' + AccessToken,
			'Client-Id': ClientID,
			'Content-Type': 'application/json'
		}
		let response = await fetch(
			input, init
		);
		//console.log("API response:",response);
		//console.log("API response body:",await response.json());
		if(response.status == 401) {
			if(AccessToken == BotUserAccessToken) {
				let ResponseValidate = await ValidateBotUserAccessToken();
				//console.log("ResponseValidate:",ResponseValidate);
				//console.log("ResponseValidate.json():",await ResponseValidate.json());
				if(ResponseValidate.status != 401) { // token still valid, previous 401 not due to invalid token
					return response;
				}
				await RefreshBotUserAccessToken();
				AccessToken = BotUserAccessToken;
			} else if(AccessToken == BroadcasterAccessToken) {
				let ResponseValidate = await ValidateBroadcasterAccessToken();
				//console.log("ResponseValidate:",ResponseValidate);
				//console.log("ResponseValidate.json():",await ResponseValidate.json());
				if(ResponseValidate.status != 401) // token still valid, previous 401 not due to invalid token
					return response;
				await RefreshBroadcasterAccessToken();
				AccessToken = BroadcasterAccessToken;
			}
			init.headers = {
				'Authorization': 'Bearer ' + AccessToken,
				'Client-Id': ClientID,
				'Content-Type': 'application/json'
			}
			let RetryResponse = await fetch(
				input, init
			);
			return RetryResponse;
		}
		return response;
	}
	/**
	 * @brief bans the user from the broadcasters chat
	 * @param UserID user to be banned
	 * @param BroadcasterID broadcaster
	 * @param Reason reason for ban
	 */
	export async function BanUser(UserID: string,BroadcasterID: string,Reason: string): Promise<void> {
		console.log(`\x1b[31m${BroadcasterID}\x1b[34m ban\x1b[32m ${UserID}\x1b[0m`);
		let response = await Synchronous(
			`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${BroadcasterID}&moderator_id=${BotUserID}`, {
				method: "POST",
				body: JSON.stringify({
					data: {
						user_id: UserID,
						reason: Reason
					}
				})
			},BotUserAccessToken
		);
		let data = await response.json();
		Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(data));
		//console.log("ban response:",data);
	}
	/**
	 * @brief sends a message to chat
	 * @param chatMessage text to send
	 */
	export async function SendChatMessage(chatMessage: string) {
		let response = await Synchronous('https://api.twitch.tv/helix/chat/messages', {
				method: 'POST',
				body: JSON.stringify({
					broadcaster_id: ChannelUserID,
					sender_id: BotUserID,
					message: chatMessage
				})
			},BotUserAccessToken
		);
		let data = await response.json();
		Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(data));
		//console.log("send message response:",data);
	}
	/**
	 * @brief releases a message held by automod automod into chat
	 * @param MessageID the id of the message to be released
	 */
	export async function AutomodRelease(MessageID: string) {
		console.log(`\x1b[34m automod release\x1b[32m ${MessageID}\x1b[0m`);
		let response = await Synchronous('https://api.twitch.tv/helix/chat/messages', {
				method: 'POST',
				body: JSON.stringify({
					user_id: BotUserID,
					msg_id: MessageID,
					action: "ALLOW"
				})
			},BotUserAccessToken
		);
		let data = await response.json();
		Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(data));
		//console.log("twitch automod release response:",response);
		//console.log("twitch automod release response body:",data);
	}
	/**
	 * @brief deletes a message from chat
	 * @param message message to delete
	 */
	export async function deleteMessage(message: Types.Twitch.Event.ChatMessage): Promise<void> {
		console.log(`\x1b[31m${message.broadcaster_user_name}\x1b[34m delete message\x1b[32m ${message.message_id}\x1b[0m`);
		let response = await Synchronous(
			`https://api.twitch.tv/helix/moderation/chat?broadcaster_id=${message.broadcaster_user_id}&moderator_id=${BotUserID}&message_id=${message.message_id}`, {
				method: "DELETE"
			},BotUserAccessToken
		);
		let data = await response.json();
		Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(data));
		//console.log("delete response:",data);
	}
	/**
	 * @brief gives VIP status to a user in the broadcasters chat
	 * @param UserID the id of the user who is to receive VIP status
	 * @param BroadcasterID broadcaster
	 * @returns
	 */
	export async function AddVIP(UserID: string,BroadcasterID: string): Promise<any> {
		console.log(`\x1b[31m${BroadcasterID}\x1b[34m add vip\x1b[32m ${UserID}\x1b[0m`);
		let response = await Synchronous(
			`https://api.twitch.tv/helix/channels/vips?broadcaster_id=${BroadcasterID}&user_id=${UserID}`, {
				method: "POST",
			},BroadcasterAccessToken
		);
		let data: any = await response.json();
		Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(data));
		//console.log("add VIP response:",data);
		return data;
	}
	/**
	 * @brief retrives data on a user
	 * @param login_name login name of the user to retrieve data on
	 * @returns
	 */
	export async function GetTwitchUserInfo(login_name: string): Promise<any> {
		let response = await Synchronous(
			`https://api.twitch.tv/helix/users?login=${login_name}`, {
				method: "GET",
			},BotUserAccessToken
		);
		//console.log("user info response:",response);
		//console.log("user info response body:",await response.json());
		let body: any = await response.json();
		Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(body));
		return body.data[0];
	}

	/**
	 * Disables a reward causing viewers to be unable to see it
	 * @param RewardID id of the reward
	 * @param BroadcasterID broadcaster id
	 */
	export async function DisableReward(RewardID: string, BroadcasterID: string = ChannelUserID): Promise<void> {
		let response = await Synchronous(
			`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${BroadcasterID}&id=${RewardID}`, {
				method: "PATCH",
				body: JSON.stringify({
					is_enabled: false
				})
			},BroadcasterAccessToken
		);
		//console.log("reward update response:",response);
		//console.log("reward update response body:",await response.json());
		let body: any = await response.json();
		Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(body));
	}
	/**
	 * Enables a reward allowing viewers to see it
	 * @param RewardID id of the reward
	 * @param BroadcasterID broadcaster id
	 */
	export async function EnableReward(RewardID: string, BroadcasterID: string = ChannelUserID): Promise<void> {
		let response = await Synchronous(
			`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${BroadcasterID}&id=${RewardID}`, {
				method: "PATCH",
				body: JSON.stringify({
					is_enabled: true
				})
			},BroadcasterAccessToken
		);
		//console.log("reward update response:",response);
		//console.log("reward update response body:",await response.json());
		let body: any = await response.json();
		Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(body));
	}
	/**
	 * @brief retrives channel information such as category, tags, etc.
	 * @param broadcaster_id id of the broadcaster
	 * @returns
	 */
	export async function GetChannelInfo(broadcaster_id: string): Promise<Types.Twitch.ChannelInfo> {
		let response = await Synchronous(
			`https://api.twitch.tv/helix/channels?broadcaster_id=${broadcaster_id}`, {
				method: "GET",
			},BotUserAccessToken
		);
		//console.log("channel info response:",response);
		//console.log("channel info response body:",await response.json());
		let body: any = await response.json();
		Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(body));
		return body.data[0];
	}
	/**
	 * @brief marks a redemption as completed
	 * @param redemption the redemption add event object
	 * @returns
	 */
	export async function CompleteCustomReward(redemption: Types.Twitch.Event.ChannelPointsRedemption): Promise<void> {
		let response = await Synchronous(
			`https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=${redemption.broadcaster_user_id}&id=${redemption.id}&reward_id=${redemption.reward.id}`, {
				method: "PATCH",
				body: JSON.stringify({
					status: 'FULFILLED'
				})
			},BroadcasterAccessToken
		);
		//console.log("complete redemption response:",response);
		//console.log("complete redemption response body:",await response.json());
		let body: any = await response.json();
		Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(body));
		//return body.data[0];
	}
	/**
	 * @brief marks a redemption as rejected, refunding channel points
	 * @param redemption the redemption add event object
	 * @returns
	 */
	export async function RejectCustomReward(redemption: Types.Twitch.Event.ChannelPointsRedemption): Promise<void> {
		let response = await Synchronous(
			`https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=${redemption.broadcaster_user_id}&id=${redemption.id}&reward_id=${redemption.reward.id}`, {
				method: "PATCH",
				body: JSON.stringify({
					status: 'CANCELED'
				})
			},BroadcasterAccessToken
		);
		let body: any = await response.json();
		//console.log("reject redemption response:",response);
		//console.log("reject redemption response body:",body);
		Database.AddAPIMessage(JSON.stringify(response),JSON.stringify(body));
		//return body.data[0];
	}
}
