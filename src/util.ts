//.
//. Milliseconds to duration string

import { ReadableStream, ReadableStreamDefaultReader, ReadableStreamReadResult } from "stream/web";
import { db } from "./Database.js";
import * as fs from 'fs';

//.
export function MillisecondsToDurationString(ms: number): string {
	var daysDifference = Math.floor(ms/1000/60/60/24);
    ms -= daysDifference*1000*60*60*24
    var hoursDifference = Math.floor(ms/1000/60/60);
    ms -= hoursDifference*1000*60*60
    var minutesDifference = Math.floor(ms/1000/60);
    ms -= minutesDifference*1000*60
    var secondsDifference = Math.floor(ms/1000);
    var result = "";
	if(daysDifference == 1) {
		result += `${daysDifference} day `
	} else if(daysDifference > 1) {
		result += `${daysDifference} days `
	}
	if(hoursDifference == 1) {
		result += `${hoursDifference} hour `
	} else if(hoursDifference > 1) {
		result += `${hoursDifference} hours `
	}
	if(minutesDifference == 1) {
		result += `${minutesDifference} minute `
	} else if(minutesDifference > 1) {
		result += `${minutesDifference} minutes `
	}
	if(secondsDifference == 1) {
		result += `${secondsDifference} second `
	} else if(secondsDifference > 1) {
		result += `${secondsDifference} seconds `
	}
	return result.trim();
}
//.
//. time diff
//.
export function TimeDifference(start: number,end: number) {
    var difference = end - start;
    return MillisecondsToDurationString(difference);
}
//.
//. add message to private database
//.
export async function AddMesageToDatabase(UserID: string,Username: string,MessageID: string,MessageText: string) {
	await db.query(
		`INSERT INTO ChatMessages (UserID,Username,MessageID,MessageText) VALUES ('${UserID}','${Username}','${MessageID}','${sql_format_string(MessageText)}')`
	).then((rows) => {/*console.log(rows);*/}).then((res) => {/*console.log(res);*/}).catch(err => {console.log(err);});
}
//+
//+ Increment User Watchtime
//+
export async function IncrementUserWatchtime(UserID: string): Promise<void> {
	await db.query(
		`SELECT * FROM Users WHERE UserID='${UserID}'`
	).then(
		(rows: any) => {
			//console.log(rows);
			//console.log(res);
			if(rows.length < 1) {
				db.query(
					`INSERT INTO Users (UserID) VALUES ('${UserID}')`
				).then((rows) => {/*console.log(rows);*/}).then((res) => {/*console.log(res);*/}).catch(err => {console.log(err);});
			} else {
				db.query(
					`UPDATE Users SET Watchtime=${rows[0].Watchtime+(5*60)} WHERE UserID='${rows[0].UserID}'`
				).then((rows) => {/*console.log(rows);*/}).then((res) => {/*console.log(res);*/}).catch(err => {console.log(err);});
			}
		}
	).catch(err => {console.log(err);});
}
//*
//* remove accents from text
//*
export function deaccent(string: string){
	return string.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
//,
//, format string for sql
//,
export function sql_format_string(str: string): string {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\"+char; // prepends a backslash to backslash, percent and double/single quotes
            default:
                return char;
        }
    });
}

// Import FileSystemWritableFileStream type for clarity (if using File System Access API)
type FileSystemWritableFileStream = {
    write: (data: Uint8Array) => Promise<void>;
    close: () => Promise<void>;
};

// Function to convert ReadableStream to Uint8Array
export async function streamToArrayBufferView(
    readableStream: ReadableStream<any>
): Promise<Uint8Array> {
    const reader: ReadableStreamDefaultReader<Uint8Array> = readableStream.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    // Read the stream
    while (true) {
        const { done, value }: ReadableStreamReadResult<Uint8Array> = await reader.read();
        if (done) {
            break;
        }
        if (value) {
            chunks.push(value);
            totalLength += value.length; // Accumulate total length
        }
    }

    // Create an ArrayBuffer to hold the entire data
    const resultBuffer: Uint8Array = new Uint8Array(totalLength);
    let offset = 0;

    // Concatenate chunks into the ArrayBuffer
    for (const chunk of chunks) {
        resultBuffer.set(chunk, offset);
        offset += chunk.length;
    }

    return resultBuffer; // This is a Uint8Array (which is a view on ArrayBuffer)
}

// Function to save the stream to a file (takes file path as a string)
export async function saveStreamToFile(
    readableStream: ReadableStream<any>,
    filePath: string
): Promise<void> {
    const binaryData: Uint8Array = await streamToArrayBufferView(readableStream);

    // Write the binary data to a file using Node.js's fs.promises
    fs.writeFileSync(filePath, binaryData);
}

