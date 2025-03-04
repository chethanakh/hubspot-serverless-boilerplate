const fs = require("fs");
const path = require("path");
const http = require("http");

const endpointsMap = {};

async function readFolders(functionsArray) {
  for (const folder of functionsArray) {
    const folderPath = path.resolve(folder);
    const serverlessFile = path.join(folderPath, "serverless.json");

    if (fs.existsSync(serverlessFile)) {
      const jsonData = JSON.parse(fs.readFileSync(serverlessFile, "utf-8"));
      if (jsonData.endpoints) {
        for (const [endpoint, config] of Object.entries(jsonData.endpoints)) {
          const filePath = path.join(folderPath, config.file);
          if (fs.existsSync(filePath)) {
            console.log(`Requiring file: ${filePath}`);
            endpointsMap[`/_hcms/api/${endpoint}`] = require(filePath);
          } else {
            console.warn(`File not found: ${filePath}`);
          }
        }
      }
    } else {
      console.warn(`serverless.json not found in folder: ${folder}`);
    }
  }
}

const server = http.createServer(async (req, res) => {
  const { url } = req;

  let body = [];
  req
    .on("data", (chunk) => {
      body.push(chunk);
    })
    .on("end", async () => {
      try {
        body = body.length ? JSON.parse(Buffer.concat(body).toString()) : {};
      } catch (error) {
        console.error("Invalid JSON:", error);
      }

      let response;
      const sendResponse = (obj) => {
        response = obj;
      };

      if (endpointsMap[url]) {
        await endpointsMap[url].main({ ...req, body }, sendResponse);
      } else {
        response = {
          statusCode: 404,
          body: { message: "Not found" },
        };
      }

      const { statusCode, body: responseBody } = response;

      res.writeHead(statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(responseBody));
    });
});

const functionsArray = ["test.functions"];
readFolders(functionsArray).then(() => {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
