import {Types} from 'Types';
import Prism from 'prismjs';

export var PageInput: {
	ServerAddress: string;
	ServerPort: number;
	response: any;
	body: any;
};

export async function main() {
	const response = document.getElementById('response');
	if(response)response.innerHTML = JSON.stringify(JSON.parse(PageInput.response),null,4);
	const body = document.getElementById('body');
	if(body)body.innerHTML = JSON.stringify(JSON.parse(PageInput.body),null,4);
}
