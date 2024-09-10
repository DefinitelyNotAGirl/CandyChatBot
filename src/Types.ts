export namespace Types {
	export type DashboardServerMessage = {
		type: string;
		object?: any;
	}
	export namespace Twitch {
		export namespace EventSub {
			export class Transport {
				method: string = "";
				session_id: string | undefined;
			}
			export interface Condition {
				broadcaster_user_id?: string
				user_id?: string
			}
			export class Subscription {
				id: string = "";
				status: string = "";
				type: string = "";
				version: string = "";
				condition: any;
				transport: Transport = new Transport;
				created_at: string = "";
				cost: number = 0;
			}
			export interface Subscriptions {
				data: Subscription[]
				total: number
				total_cost: number
				max_total_cost: number
				pagination: Pagination
			}
			export interface Pagination {}
		}
		export class Badge {
			set_id: string = "";
			id: string = "";
			info: string = "";
		}
		export class MessageContent {
			text: string = "";
			fragments: any;
		}
		
		export type ChannelInfo = {
			broadcaster_id: string
			broadcaster_login: string
			broadcaster_name: string
			broadcaster_language: string
			game_id: string
			game_name: string
			title: string
			delay: number
			tags: Array<string>
			content_classification_labels: Array<string>
			is_branded_content: boolean
		}
		export namespace Event {
			export class ChatMessage {
				broadcaster_user_id: string = "";
				broadcaster_user_login: string = "";
				broadcaster_user_name: string = "";
				chatter_user_id: string = "";
				chatter_user_login: string = "";
				chatter_user_name: string = "";
				message_id: string = "";
				message: MessageContent = new MessageContent;
				color: string = "";
				badges: Badge[] = [];
				message_type: string = "";
				cheer: undefined;
				reply: undefined;
				channel_points_custom_reward_id: undefined;
				channel_points_animation_id: undefined;
			}
			export type ChannelPointsRedemption = {
				broadcaster_user_id: string
				broadcaster_user_name: string
				broadcaster_user_login: string
				user_id: string
				user_name: string
				user_login: string
				id: string
				reward: {
					id?: string,
					type?: string
					cost: number
					title?: string
					unlocked_emote?: any
					prompt?: string
				}
				message?: {
					text: string
					emotes: Array<{
						id: string
						begin: number
						end: number
					}>
				}
				user_input: string
				redeemed_at: string
			}
			export type ChannelUpdate = {
				broadcaster_user_id: string
				broadcaster_user_login: string
				broadcaster_user_name: string
				title: string
				language: string
				category_id: string
				category_name: string
				content_classification_labels: Array<string>
			}
		}
	}
	
	export namespace Database {
		export type Reward = {
			ID: number
			Games: string
			Title: string
			IsGameSpecific: number
			Description: string
			Background: string
			Icon: any
			RewardID: any
			cost: number
		}
	}
	export namespace HTTP {
		export type Socket = {
			Name: string;
			Url: string;
			ConnectTime: number;
			status: number;
		}
	}
	export namespace Discord {
		export type Message = {
			reactions: Array<{
				count: number
				count_details: {
					burst: number
					normal: number
				}
				me: boolean
				me_burst: boolean
				emoji: {
					id: any
					name: string
				}
				burst_colors: Array<any>
			}>
			attachments: Array<any>
			tts: boolean
			embeds: Array<any>
			timestamp: string
			mention_everyone: boolean
			id: string
			pinned: boolean
			edited_timestamp: any
			author: {
				username: string
				discriminator: string
				id: string
				avatar: string
			}
			mention_roles: Array<any>
			content: string
			channel_id: string
			mentions: Array<any>
			type: number
		}
		export type Emoji = {
			id: string | null
			name: string | null
			roles?: Array<string>
			user?: {
				username?: string
				discriminator?: string
				id?: string
				avatar?: string
				public_flags?: number
			}
			require_colons?: boolean
			managed?: boolean
			animated?: boolean
		}
		export type AddReactionEvent = {
			user_id: string
			type: number
			message_id: string
			message_author_id: string
			member: {
				user: Array<any>
				roles: Array<any>
				premium_since: any
				pending: boolean
				nick: any
				mute: boolean
				joined_at: string
				flags: number
				deaf: boolean
				communication_disabled_until: any
				banner: any
				avatar: any
			}
			emoji: {
				name: string
				id: any
			}
			channel_id: string
			burst: boolean
			guild_id: string
		}		  
	}
	
}