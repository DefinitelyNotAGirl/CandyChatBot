import { db } from './Database.js';
import * as Request from './Requests.js'
import { sql_format_string } from './util.js';
import { SendDashboardMessage } from './WebServer.js';

export namespace log {
	export async function write(log: {
		Message: string,
		Action: string,
		Type: string,
	}) {
		await db.query(
			`INSERT INTO Log (Type,Action,Message) VALUES ('','${sql_format_string(log.Action)}','${sql_format_string(log.Message)}')`
		).then((rows: any[]) => {/*console.log(rows);*/}).catch(err => {console.log(err);});
		SendDashboardMessage({
			type: 'log',
			object: {
				Message: log.Message,
				Action: log.Action,
				Type: log.Type,
				Time: ''
			}
		});
	}
	export async function ban(username: string, platform: string, reason: string) {
		var message = `banned ${username} from ${platform} chat for ${reason}`;
		write({
			Message: `banned ${username} from ${platform} chat for ${reason}`,
			Action: 'ban',
			Type: 'action',
		});
	}
	export async function timeout(username: string, platform: string, reason: string) {
		write({
			Message: `timed out ${username} in ${platform} chat for ${reason}`,
			Action: 'timeout',
			Type: 'action',
		});
	}
	export async function vip(username: string, platform: string) {
		write({
			Message: `gave vip status to ${username} n ${platform}`,
			Action: 'vip',
			Type: 'action',
		});
	}
	export async function connect(host: string, port: number) {
		write({
			Message: `connected to ${host}:${port}`,
			Action: 'connect',
			Type: 'action',
		});
	}
	export async function connect_url(url: string) {
		write({
			Message: `connected to ${url}`,
			Action: 'connect',
			Type: 'action',
		});
	}
	export async function refreshTokens(platform: string) {
		write({
			Message: `refreshed ${platform} api tokens`,
			Action: 'refreshTokens',
			Type: 'action',
		});
	}
	export async function APIMessage(url: string,response: string,content: string, dolog: Boolean = false) {
		const id = await Request.Database.AddAPIMessage(response,content,dolog);
		if(id == 0) {
			write({
				Message: `<a href='/api-message/${id}'>message from ${url}</a>`,
				Action: 'api-message',
				Type: 'debug',
			});
		}
	}
	export async function APIError(url: string,response: string,content: string, dolog: Boolean = false) {
		const id = await Request.Database.AddAPIMessage(response,content,dolog);
		if(id == 0) {
			write({
				Message: `<a href='/api-message/${id}'>message from ${url}</a>`,
				Action: 'api-error',
				Type: 'debug',
			});
		}
	}
}