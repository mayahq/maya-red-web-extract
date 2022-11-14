const {
    Node,
    Schema,
    fields
} = require('@mayahq/module-sdk')

const https = require('follow-redirects').https;
const url = require('url');
const unfluff = require('unfluff');

const DEFAULT_PARSE = {
    title: "",
    softTitle: "",
    date: "",
    copyright: "",
    author: "",
    publisher: "",
    text: "",
    image: "",
    videos: "",
    tags: "",
    canonicalLink: "",
    lang: "",
    description: "",
    favicon: "",
    links: ""
}

const makeHttpCall = async (options) => {
	return new Promise((resolve) => {
		var req = https.request(options, res => {
			res.setEncoding('utf8');
			var returnData = "";
			res.on('data', chunk => {
				returnData = returnData + chunk;
			});
			res.on('end', () => {
				// let results = JSON.parse(returnData);
				// resolve(results);
				resolve(returnData);
			});
		});
		if (options.method == 'POST' || options.method == 'PATCH') {
			req.write(JSON.stringify(options.body));
		}
		req.end();
	})
}

async function getText(urlString) {
	try {
		let parsed_url = url.parse(urlString);
		let options = {
			host: parsed_url.host,
			path: parsed_url.path,
			method: 'GET',
			headers: {
				'Content-Type': 'text/html',
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
			}
		}

		let html = await makeHttpCall(options);
		let res = unfluff(html);

		return res;
	} catch (error) {
		return 'error: ' + error;
	}
}

class Extract extends Node {
    constructor(node, RED, opts) {
        super(node, RED, {
            ...opts,
            // masterKey: 'You can set this property to make the node fall back to this key if Maya does not provide one'
        })
    }

    static schema = new Schema({
        name: 'extract',
        label: 'extract',
        category: 'Maya Red Web Extract',
        isConfig: false,
        fields: {
            options: new fields.DynamicFieldList({
                rowFields: {
                    url: new fields.Typed({ type: "msg", allowedTypes: ["str", "msg"], defaultVal: "payload"})
                },
                displayName: "URLs"
            }),
            failOnAnyError: new fields.Typed({type: "bool", allowedTypes: ["bool"], "defaultVal": "false", displayName: "Fail On Any Error"})
        },
        color: "#F82B60",
        exportable: true,
        icon: "extract.png"

    })

    onInit() {
        // Do something on initialization of node
    }

    async onMessage(msg, vals) {
        // Handle the message. The returned value will
        // be sent as the message to any further nodes.
        let urls = vals.options;
        msg.payload["webExtract"] = []
        const errors = [];
        for(let index = 0; index < urls.length; index++) {
            this.setStatus('PROGRESS', 'Requesting '+ urls[index].url);
            try{
                if(/^(http(s):\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g.test(urls[index])) {
                    let results = await getText(urls[index].url);
                    msg.payload["webExtract"].push(results);
                    this.setStatus("SUCCESS", `Parsed`);
                } {
                    msg.payload["webExtract"].push(DEFAULT_PARSE)
                }
            } catch (error){
                this.setStatus.status("PROGRESS", 'error - ' + urls[index].url);
                msg.payload["webExtract"].push({ ...DEFAULT_PARSE, error: "parse_error"})
                errors.push(error.description)
                this.setStatus("ERROR", error.description);
            }
        }
        if(vals.failOnAnyError && errors.length > 0){
            msg.__error = error;
            msg.__isError = true
        }
        return msg

    }
}

module.exports = Extract