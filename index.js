const fs = require('fs');

const credentials = {
    key: fs.readFileSync('private.key', 'utf8'),
    cert: fs.readFileSync('sander_gielisse_me.cer', 'utf8'),
    ca: [
        fs.readFileSync('Sectigo_RSA_Domain_Validation_Secure_Server_CA.crt', 'utf8'),
        fs.readFileSync('USERTrust_RSA_Certification_Authority.crt', 'utf8'),
    ]
};

const express = require('express');
const app = express()
const path = require('path');
const bodyParser = require('body-parser');

// allow access to public folder
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

files = {
    "0": "toloka/index.html",
    "1": "toloka/script.js"
}

app.get('/request_file', (req, res) => {
    var filename = files[req.query.filename]

    var mime;
    if (filename.endsWith(".js")) {
        mime = "application/javascript";
    } else if (filename.endsWith(".html")){
        mime = "text/html";
    }

    var identifier = req.query.identifier
    // lookup the file in the public dir
    var filepath = path.join(__dirname, '/public/' + filename)
    console.log("requesting file... ", filepath, ' with id ', identifier, ' and mime ', mime)
    fs.readFile(filepath, "utf8", function(err, data) {
        data = data.replace(/%IDENTIFIER%/g, identifier);
        res.contentType(mime);
        res.send(data);
    });
})

app.post('/confirm_answers', function(req, res) {
    console.log("BODY", req.body)
    // save this information
    var submission = req.body
    var id = submission['id']
    var json = JSON.stringify(submission);
    fs.writeFile('./submissions/' + id + '.json', json, 'utf8', function(err){
        console.log("ERROR " + err);
    });
    console.log("Submission saved!");

    res.sendStatus(200)
});


app.get('/isdone', (req, res) => {
    var id = req.query.id;
    var file = './submissions/' + id + '.json'
    var r = "false";
    if (fs.existsSync(file)){
        r = "true";
    }
    res.setHeader('Access-Control-Allow-Origin', 'https://iframe-toloka.com');
    res.send(r)
})

const https = require('https');
var httpsServer = https.createServer(credentials, app);
httpsServer.listen(443);
