//  OVERVIEW
//  This script is intended to demonstrate the process of creating a new record in Content Manager
//  and attaching an electronic document to it, via the API.
//
//  There are two calls to the Content Manager API.  The first is to create the record, 
//  the second associates an electronic document with the record.
//
//  In order to attach an electronic document to a record in Content Manager, the API
//  requires that the electroic document is stored locally on the server running the
//  Content Manager API.  In this example, I have used WebDAV to upload the configured 
//  "uploadBasePath"; e.g. C:\Micro Focus Content Manager\ServiceAPIWorkpath\Uploads\ on
//  the Content Manager API server.
//  
//  The sequence of events is as follows:
//  1) Create a new record in Content Manager (invoke Content Manager API);
//  2) Use WebDAV to upload the electronic document to "uploadBasePath";
//  3) Attach the electronic document to the record created in step 1 (invoke Content Manager API).
//
//  LANGUAGE / RUNTIME ENVIRONMENT
//  The demo uses Node.js runtime environment.  See: https://nodejs.org/en/
//  
//  The following node packages are used:
//  1) axios - see: https://github.com/axios/axios
//  2) webdav - see: https://www.npmjs.com/package/webdav
//  3) uuid - https://www.npmjs.com/package/uuid
//  4) dateformat // See https://www.npmjs.com/package/dateformat



// get dependencies
const dateFormat = require('dateformat');
require('dotenv').config();
const { createClient } = require('webdav');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require("fs"); // currently only used for mimicking the Webhook call.

// define constants
const adobeSignClientId = process.env['ADOBE_SIGN_CLIENT_ID'];
const adobeSignClientSecret = process.env['ADOBE_SIGN_CLIENT_SECRET'];
const adobeSignRefreshToken = process.env['ADOBE_SIGN_REFRESH_TOKEN'];
const contentManagerUsername = process.env['CONTENT_MANAGER_USERNAME'];
const contentManagerPassword = process.env['CONTENT_MANAGER_PASSWORD'];
const authorizationHeaderValue = "Basic " + Buffer.from(contentManagerUsername + ":" + contentManagerPassword).toString('base64');
const contentManagerServiceAPIBaseUrl = process.env['CONTENT_MANAGER_API_BASE_URL'];
const contentManagerWedDAVUrl = process.env['CONTENT_MANAGER_WEBDAV_URL'];
const adobeSignBaseUrl = process.env['ADOBE_SIGN_BASE_URL'];

// console colors
const escapeCharcters = "\x1b";
const resetColor = "\x1b[0m";
const cyan = escapeCharcters + "[36m";
const red = escapeCharcters + "[31m";
const yellow = escapeCharcters + "[33m";
const green = escapeCharcters + "[32m";
const white = escapeCharcters + "[37m";

//set global variables
var gblCreateRecordJSON = {
	"RecordTitle":"Adobe Sign Integration Demo 3",
	"RecordRecordType":"Document"
}

// function used to return timestamps for use with console logging.
function getTimeStamp(){
	now = Date();
	return cyan + dateFormat(now, "dd-mm-yyyy, HH:MM:ss") + " :" + resetColor;
}

// create a record in Content Manager
function createRecord(jsonData, electronicDocument)
	{
		var config = {
		  method: 'post',
		  url: contentManagerServiceAPIBaseUrl + '/Record',
		  headers: { 
			'Authorization': authorizationHeaderValue, 
			'Content-Type': 'application/json', 
		  },
		  data : JSON.stringify(jsonData)
		};
		axios(config)
		
		.then(function (response) {

			console.log(getTimeStamp(), green + "New Content Manager record successfully created.", resetColor)
			
			// create a uuid to use as the filename for the WebDAV upload.
			var filename = uuidv4() + ".pdf";

			// perform the WebDAV upload and THEN attach the document to the record.			
			uploadDocument(response.data.Results[0].Uri, filename, electronicDocument)
			
		})
		.catch(function (error) {
		  console.log(getTimeStamp(), red + "Error creating Content Manager record.", resetColor)
		  console.log(error);
		});
	}

function uploadDocument(uri, filename, electronicDocument)
	{	
		const webDAVClient = createClient(
			contentManagerWedDAVUrl,
			{
				username: contentManagerUsername,
				password: contentManagerPassword
			}
		);

		webDAVClient
			 .putFileContents("/" + filename, electronicDocument)
			 .then(function (response) {
			 console.log(getTimeStamp(), green + "Document successfully transferred to WebDAV folder.", resetColor)
			
			// only the record Uri and the RecordFilePath are required to attach a document to a record.
			var attachDocumentJSON = {
				"Uri": uri,
				"RecordFilePath": filename
			}
			
			// attach the document to the record.
			attachDocument(attachDocumentJSON)
			
			 })
		.catch(function (error) {
			console.log(getTimeStamp(), red + "Error transferring file to WebDAV folder.", resetColor)
			console.log(error)	
		});
	}

function attachDocument(jsonData)
	{
	var config = {
		  method: 'POST',
		  url: contentManagerServiceAPIBaseUrl + '/Record',
		  headers: { 
			'Authorization': authorizationHeaderValue, 
			'Content-Type': 'application/json', 
		  },
		  data : JSON.stringify(jsonData)
		};
		axios(config)
		
		.then(function (response) {
			console.log(getTimeStamp(), green + "Document successfully attached to the Content Manager record.", resetColor)
		})
		.catch(function (error) {
		  console.log(getTimeStamp(), red + "Error attaching document to the Content Manager record.", resetColor)
		  console.log(error);
		});
	}

function downloadAgreementDocument(accessToken, agreementId){
	var config = {
	  method: 'get',
	  url: adobeSignBaseUrl + '/api/rest/v6/agreements/' + agreementId + '/combinedDocument?attachSupportingDocuments=false',
	  responseType: 'arraybuffer',
	  headers: { 
		'Authorization': 'Bearer ' + accessToken
	  }
	};

	axios(config)
	.then(function (response) {
		console.log(getTimeStamp(), green + "Document downloaded from Adobe Sign.", resetColor)

		var electronicDocument = Buffer.from(response.data)
		createRecord(gblCreateRecordJSON, electronicDocument)

	})
	.catch(function (error) {
	    console.log(getTimeStamp(), green + "Error downloading document from Adobe Sign.", resetColor)
		console.log(error);
	});
}
	
function refreshAdobeAccessToken()
	{
	  var config = {
	  method: 'POST',
	  url: adobeSignBaseUrl + '/oauth/refresh?refresh_token=' + adobeSignRefreshToken + '&client_id=' + adobeSignClientId + '&client_secret=' + adobeSignClientSecret + '&grant_type=refresh_token',
	  headers: { 
		'Content-Type': 'application/x-www-form-urlencoded'
	  }
	};

	axios(config)
	.then(function (response) {
		console.log(getTimeStamp(), green + "Adobe Sign Access Token updated.", resetColor)
		
		downloadAgreementDocument(response.data.access_token, gblAgreementId);

	})
	.catch(function (error) {
		console.log(getTimeStamp(), red + "Error updating Adobe Sign Access Token.", resetColor)
		console.log(error);
	});
}


// Get Adobe Sign Webhook JSON data from example file.  In a real-world scenario this would be pased to the event triggered by the Adobe Sign Webhook call.

var fileContents = fs.readFileSync("AdobeSignWebhookExample.json");
var gblAdobeWebhookJSON = JSON.parse(fileContents);
var gblAgreementId = gblAdobeWebhookJSON.agreement.id;

refreshAdobeAccessToken();

	