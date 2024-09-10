import { Types } from './Types.js'
import * as Request from './Requests.js';
import WebSocket from 'ws';
import { sql_format_string } from './util.js';
import { ChannelUserID, db } from './Database.js';

export namespace Discord {
	//+
	//+ memory cache
	//+
	var GatewayURL: string = "";
	var BotToken: string = "";
	var ClientID: string = "";
	var ClientSecret: string = "";
	var BroadcasterUserID: string = "";
	var MasterUserID: string = "";
	var BotUserID: string = "";
	export var RedemptionsTargetChannel: string = "";
	//
	//
	//
	export async function LoadSettings() {
		BotToken = await Request.Database.GetSetting("DiscordBotAuthToken");
		ClientID = await Request.Database.GetSetting("DiscordClientID");
		ClientSecret = await Request.Database.GetSetting("DiscordClientSecret");
		RedemptionsTargetChannel = await Request.Database.GetSetting("DiscordRedemptionsTargetChannel");
		BroadcasterUserID = await Request.Database.GetSetting("DiscordBroadcasterUserID");
		MasterUserID = await Request.Database.GetSetting("DiscordMasterUserID");
		BotUserID = await Request.Database.GetSetting("DiscordBotUserID");
	}

	async function Synchronous(input: string, init: any) {
		if(init.headers != undefined) {
			console.log("warning: API request headers overwrite");
		}
		init.headers = {
			'Authorization': 'Bot ' + BotToken,
			'Client-Id': ClientID,
			'Content-Type': 'application/json'
		}
		let response = await fetch(
			"https://discord.com/api"+input, init
		);
		return response;
	}
	export async function SendMessage(ChannelID: string, Content: string): Promise<Types.Discord.Message> {
		let response = await Synchronous(
			`/channels/${ChannelID}/messages`, {
				method: "POST",
				body: JSON.stringify({
					content: Content
				})
			}
		);
		let bj: any = await response.json();
		//console.log("send message response",response,"body",bj);
		let Message: Types.Discord.Message = bj;
		return Message;
	}
	export async function AddReaction(Message: Types.Discord.Message, Emoji: string) {
		let response = await Synchronous(
			`/channels/${Message.channel_id}/messages/${Message.id}/reactions/${Emoji}/@me`, {
				method: "PUT",
			}
		);
		//console.log("add reaction response",response);
		return response;
	}
	/**
	 * @brief sends a discord message representing the reward redemption, also adds reactions to control completion and rejection
	 * @param User 
	 * @param Action 
	 */
	export async function SendTwitchRedemptionNotification(User: string, Action: string): Promise<string> {
		let Message = await SendMessage(
			RedemptionsTargetChannel,
			`${Action} ~ redeemed by ${User}`
		);
		let response = await AddReaction(Message,"❌");
		let ratelimitresetheader = response.headers.get('x-ratelimit-reset-after');
		if(ratelimitresetheader != null) {
			setTimeout(() => {
				AddReaction(Message,"🟢");
			}, parseInt(ratelimitresetheader) * 1000);
		}
		return Message.id;
	}
	export var GatewayClient: WebSocket | undefined = undefined;
	var GatewayHeartbeatInterval: NodeJS.Timeout | undefined = undefined;
	export type User = {
		id: string
		username: string
		discriminator: string
		avatar: string
		verified: boolean
		email: string
		flags: number
		banner: string
		accent_color: number
		premium_type: number
		public_flags: number
		avatar_decoration_data: {
			sku_id: string
			asset: string
		}
	}
	export type Application = {
		bot_public: boolean
		bot_require_code_grant: boolean
		cover_image: string
		description: string
		guild_id: string
		icon: any
		id: string
		integration_types_config: {
			"0": {
				oauth2_install_params: {
					scopes: Array<string>
					permissions: string
				}
			}
			"1": {
				oauth2_install_params: {
					scopes: Array<string>
					permissions: string
				}
			}
		}
		name: string
		owner: {
			avatar: any
			discriminator: string
			flags: number
			id: string
			username: string
		}
		primary_sku_id: string
		slug: string
		summary: string
		team: {
			icon: string
			id: string
			members: Array<{
				membership_state: number
				permissions: Array<string>
				team_id: string
				user: {
					avatar: string
					discriminator: string
					id: string
					username: string
				}
			}>
		}
		verify_key: string
	}
	var ReadyEvent: {
		v: number,
		user: User;
		guilds: [{
			id: string;
			unavailable: boolean;
		}];
		session_id: string;
		resume_gateway_url: string;
		shard?: [{
			shard_id: number;
			num_shards: number
		}],
		application: Application
	} | undefined = undefined;
	var LastSequenceNumber: number | null = null;
	var BlockIdentify: BigInt;
	export type GatewayEvent = {
		/**
		 * operation code
		 */
		op: number
		/**
		 * data
		 */
		d: any
		/**
		 * sequence number
		 */
		s?: number
		/**
		 * event type
		 */
		t?: string
	}
	export type GatewayDispatchEvent = {
		/**
		 * data
		 */
		d: any
		/**
		 * sequence number
		 */
		s: number
		/**
		 * event type
		 */
		t: string
	}
	export async function ConnectGateway(url: string | undefined = undefined) {
		if(url == undefined) {
			let response = await Synchronous(
				`/gateway/bot`, {
					method: "GET"
				}
			);
			if(!response.ok) {
				console.log("error getting discord gateway url",response);
				return;
			}
			let bj: any = await response.json();
			GatewayURL = bj.url;
		} else {
			GatewayURL = url;
		}
		console.log("discord gateway url",GatewayURL);
		GatewayClient = new WebSocket(`${GatewayURL}?v=10&encoding=json`);
		if(GatewayClient == undefined) {
			console.error("assertion failed: GatewayClient != undefined");
			return;
		}
		GatewayClient.on('error', console.error);
		GatewayClient.on('open', () => {
			console.log('WebSocket connection opened to ' + GatewayClient?.url);
		});
		GatewayClient.on('close', (code: number, reason: Buffer) => {
			console.log(`discord gateway connection closed - ${code} - ${(new TextDecoder()).decode(reason)}`);
			switch(code) {
				case(4001):
				case(4002):
				case(4003):
				case(4004):
				case(4005):
				case(4008):
				case(4010):
				case(4011):
				case(4011):
				case(4012):
				case(4013):
				case(4014):
					GatewayClient?.close();
					GatewayClient = undefined;
					ReadyEvent = undefined;
					break;
				case(4000):
				case(4007):
				case(4009):
					ReconnectGateway();
					break;
			}
		});
		GatewayClient.on('message', (data: any) => {
			HandleGatewayMessage(JSON.parse(data.toString()));
		});
	}
	namespace GatewayEventData {
		export type Hello = {
			heartbeat_interval: number
		}
	}
	async function SendGatewayEvent(Event: GatewayEvent) {
		const textEncoder = new TextEncoder();
		let data = textEncoder.encode(JSON.stringify(Event));
		if(data.length > 4096) {
			console.error(`error: cannot send discord gateway event because data exceeds 4096 bytes in length (length: ${data.length}).`);
			return;
		}
		if(Event.op == 2) {
			var NextRequestTime: number = parseInt(await Request.Database.GetSetting("DiscordIdentifyTimeout"));
			var TimeNow: number = Date.now();
			if(NextRequestTime < TimeNow)
				NextRequestTime = TimeNow;
			setTimeout(() => {
				GatewayClient?.send(data);
				Request.Database.UpdateSetting("DiscordIdentifyTimeout",(Date.now() + 90000).toString());
			}, NextRequestTime - TimeNow);
			return;
		}
		GatewayClient?.send(data);
	}
	var HeartbeatTimeout: NodeJS.Timeout | undefined = undefined;
	export async function DisconnectGateway() {
		GatewayClient?.close(1000);
	}
	async function ReconnectGateway() {
		console.log("discord gateway reconnecting...");
		DisconnectGateway();
		clearInterval(GatewayHeartbeatInterval);
		ConnectGateway(ReadyEvent?.resume_gateway_url);
	}
	async function SendHeartbeat() {
		SendGatewayEvent({
			op: 1,
			d: LastSequenceNumber
		});
		HeartbeatTimeout = setTimeout(() => {
			ReconnectGateway();
		}, 2000);
	}
	async function HandleGatewayMessage(Event: GatewayEvent) {
		//console.log("received discord gateway event",Event);
		//.
		//. opcode 10 - Hello
		//.
		if(Event.op == 10) {
			const data: GatewayEventData.Hello = Event.d;
			if(ReadyEvent == undefined) {
				//+
				//+ heartbeat loop
				//+
				setTimeout(() => {
					SendHeartbeat();
					GatewayHeartbeatInterval = setInterval(() => {
						SendHeartbeat();
					}, data.heartbeat_interval);
					GatewayHeartbeatInterval.unref();
				}, data.heartbeat_interval+(Math.random()*1000));
				//+
				//+ identify
				//+
				SendGatewayEvent({
					op: 2,
					d: {
						token: BotToken,
						properties: {
							os: "linux",
							browser: "nodejs",
							device: "nodejs",
						},
						presence: {
							since: null,
							activities: [{
								state: "418 I'm a teapot",
								emoji: ":black_circle:",
								type: 4
							}],
							status: "online",
							afk: false
						},
						intents: ((1 << 9) | (1 << 10))
					}
				});
			} else {
				//+
				//+ heartbeat loop
				//+
				setTimeout(() => {
					SendHeartbeat();
					GatewayHeartbeatInterval = setInterval(() => {
						SendHeartbeat();
					}, data.heartbeat_interval);
					GatewayHeartbeatInterval.unref();
				}, data.heartbeat_interval+(Math.random()*1000));
				//+
				//+ resume
				//+
				SendGatewayEvent({
					op: 6,
					d: {
						token: BotToken,
						session_id: ReadyEvent.resume_gateway_url,
						seq: LastSequenceNumber
					}
				})
			}
		}
		//.
		//. opcode 11 - Heartbeat Acknowledge
		//.
		else if(Event.op == 11) {
			//console.log("discord explicit heartbeat request");
			if(HeartbeatTimeout != undefined) {
				clearTimeout(HeartbeatTimeout);
			}
		}
		//.
		//. opcode 1 - Heartbeat
		//.
		else if(Event.op == 1) {
			//console.log("discord explicit heartbeat request");
			SendHeartbeat();
		}
		//.
		//. opcode 0 - dispatch
		//.
		else if(Event.op == 0) {
			if(Event.s != undefined && Event.t != undefined) {
				HandleDispatchEvent({
					d: Event.d,
					t: Event.t,
					s: Event.s
				});
			} else {
				console.error("invalid dispatch event",Event);
			}
		}
		//.
		//. opcode 7 - reconnect
		//.
		else if(Event.op == 7) {
			ReconnectGateway();
		}
	}

	async function DeleteMessage(ChannelID: string,MessageID: string) {
		let response = await Synchronous(
			`/channels/${ChannelID}/messages/${MessageID}`, {
				method: 'DELETE',
			}
		);
		if(response.status == 204) {
			return;
		}
		console.error("message deletion failed",response);
	}

	async function HandleAddReaction(Event: Types.Discord.AddReactionEvent) {
		if(Event.user_id == BotUserID) {
			return;
		}
		if(Event.channel_id == RedemptionsTargetChannel) {
			//console.log("redemption target channel reaction");
			await db.query(
				`SELECT * FROM Redemptions WHERE DiscordMessageID='${sql_format_string(Event.message_id)}'`
			).then((rows: any[]) => {
				if(rows.length > 0) {
					//console.log("redemption has been found");
					const RedemptionID = rows[0].RedemptionID;
					const Platform = rows[0].Platform;
					const RewardID = rows[0].RewardID;
					const DiscordMessageID = rows[0].DiscordMessageID;
					if(Event.emoji.name == '🟢') {
						if(Platform == 'Twitch') {
							Request.Twitch.CompleteCustomReward({
								broadcaster_user_id: ChannelUserID,
								id: RedemptionID,
								reward: {
									id: RewardID,
									cost: 0
								},
								redeemed_at: '',
								user_id: '',
								broadcaster_user_name: '',
								broadcaster_user_login: '',
								user_name: '',
								user_login: '',
								user_input: ''
							});
						}
						DeleteMessage(RedemptionsTargetChannel,DiscordMessageID);
						db.query(
							`UPDATE Redemptions SET status='completed' WHERE DiscordMessageID='${sql_format_string(Event.message_id)}'`
						).then((rows: any[]) => {}).catch(err => {console.log(err);});
					} else if(Event.emoji.name == '❌') {
						if(Platform == 'Twitch') {
							Request.Twitch.RejectCustomReward({
								broadcaster_user_id: ChannelUserID,
								id: RedemptionID,
								reward: {
									id: RewardID,
									cost: 0
								},
								redeemed_at: '',
								user_id: '',
								broadcaster_user_name: '',
								broadcaster_user_login: '',
								user_name: '',
								user_login: '',
								user_input: ''
							});
						}
						DeleteMessage(RedemptionsTargetChannel,DiscordMessageID);
						db.query(
							`UPDATE Redemptions SET status='rejected' WHERE DiscordMessageID='${sql_format_string(Event.message_id)}'`
						).then((rows: any[]) => {}).catch(err => {console.log(err);});
					}
				} else {
					//console.log("redemption not found");
				}
			}).catch(err => {console.log(err);});
		}
	}
	
	async function HandleDispatchEvent(Event: GatewayDispatchEvent) {
		console.log("discord gateway dispatch event:",Event.t);
		if(Event.t == 'MESSAGE_REACTION_ADD') {
			HandleAddReaction(Event.d);
		}
	}
}