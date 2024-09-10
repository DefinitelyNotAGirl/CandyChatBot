import { db } from "../../../build/Database.js";
import { Discord } from "../../../build/discord.js";
import { sql_format_string } from "../../../build/util.js";
import { Types } from "../../../build/Types.js";

export async function dynamic_run(event: Types.Twitch.Event.ChannelPointsRedemption) {
	if(!event.reward.id)return;
	const RewardText = 'Skip your next turn';
	const DiscordMessageID = await Discord.SendTwitchRedemptionNotification(event.user_name,RewardText);
	await db.query(
		`INSERT INTO Redemptions (RedemptionID,DiscordMessageID,Platform,RewardID) VALUES ('${sql_format_string(event.id)}','${sql_format_string(DiscordMessageID)}','Twitch','${sql_format_string(event.reward.id)}')`
	).then((rows: any[]) => {}).catch(err => {console.log(err);});
};