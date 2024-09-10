export var PageInput: {
	code: number,
	text: string
};

export async function main() {
	let element = document.getElementById('title');
	if(element != null) {
		element.innerHTML = `${PageInput.code} - ${PageInput.text}`;
	}
	element = document.getElementById('error-code');
	if(element != null) {
		element.innerHTML = `${PageInput.code}`;
	}
	element = document.getElementById('error-text');
	if(element != null) {
		element.innerHTML = `${PageInput.text}`;
	}
}
