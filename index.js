console.log("Starting Wikipedia Game server");

var http = require('http');
var fs = require('fs');
var path = require('path');

const mediaTypes = {
    zip: 'application/zip',
    jpg: 'image/jpeg',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript'
  }

http.createServer(function (req, res) {
    console.log(req.method + ' ' + req.url)

    let url = req.url;
    if (url === "" || url === "/" || url === "/?" || url === undefined || url === null) {
        url = "/index.html";
    }

    req.url = url;

    const filepath = path.join('docs', url)

    fs.readFile(filepath, function(err, data) {
        if (err) {
            res.statusCode = 404
            return res.end('File not found or you made an invalid request.');
        }
    
        let mediaType = 'text/html'
        const ext = path.extname(filepath)
        if (ext.length > 0 && mediaTypes.hasOwnProperty(ext.slice(1))) {
            mediaType = mediaTypes[ext.slice(1)]
        }

        res.writeHead(200, {'Content-Type': mediaType, 'Access-Control-Allow-Origin': '*'});
        res.write(data);

        return res.end();
  });
}).listen(8080); 

console.log("Started server");