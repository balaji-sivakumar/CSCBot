var restify = require('restify');
var builder = require('botbuilder');
var http = require('http');

var optionsGet = {
    host : 'localhost', // here only the domain name
    // (no http/https !)
    port : 8080,
    path : '/rest/model/atg/commerce/order/OrderLookupActor/orderLookupById?orderId=ID',
    method : 'GET'
};

console.info('Options prepared:');
console.log(optionsGet);

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
var MICROSOFT_APP_ID = "61a5b5f7-7633-41b0-b28c-0558da4c6175";
var MICROSOFT_APP_PASSWORD = "pYykopp8pTVQToKppDXwYZQ";
var LUIS_MODEL_URL="https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/381e1f22-8676-4228-bd17-e94917120526?subscription-key=fbd6c82bc4f149eeba4a1ae5d5ffde60&timezoneOffset=0&verbose=true&q=";

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: MICROSOFT_APP_ID,
    appPassword: MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
var bot = new builder.UniversalBot(connector, function (session) {
    session.send("You said: %s", session.message.text);
});
var recognizer = new builder.LuisRecognizer(LUIS_MODEL_URL);
bot.recognizer(recognizer);
bot.dialog('Greeting', function (session, args, next) {
	if(session.userData){
		var orderInfo = {
			orderId : ''
		};
		var userInfo = {
			orderInfo : orderInfo,
			email : '',
			phoneNumber : '',
			trackingNumber: '',
			totalItemCount: '',
			estimatedArrival: ''
		};
		session.userData.userInfo = userInfo;
	}
	session.send('Welcome to the CSC Bot');
	var name = builder.EntityRecognizer.findEntity(args.intent.entities, 'Name');
	
	if(name != null){
		session.send('Hello  %s!', name.entity);
		session.send('I am a Bot. How can I help you?');
	} else {
		session.send('Hi, I am a Bot. How can I help you?');
	}
}).triggerAction({
	matches: 'Greet'
});

bot.dialog('Order Status', function (session, args, next) {
	
	console.log(session.userData.userInfo);
	var verified = performVerification(session, args);
	if(verified){
		invokeATGService(session,args, function(jsonRes){
			var emailInput = session.userData.userInfo.email;
			var phoneInput = session.userData.userInfo.phoneNumber;
			var email = "";
			var phone = "";
			var status = false;
			var paymentJSON = jsonRes.paymentResult[0];
			email = paymentJSON.billingAddress.email;
			phone = paymentJSON.billingAddress.phoneNumber;
			console.log(email + ":"+ phone);
			console.log(emailInput + ":"+ phoneInput);
			if(emailInput != email &&  phoneInput != phone){
				console.log('No match!!');
				status = false;
			}else{
				status = true;
			}
			console.log('Return value..'+status);
			if(status){
				session.send('We have sucessfully verified your details');
				sendOrderStatus(session,args,jsonRes);
			}else{
				session.send('Sorry your details dont match, try again');
			}
		});
				
	}

}).triggerAction({
	matches: 'Order Status'
});

invokeATGService = function (session, args, jsonRes){
	console.log('BEGIN: Invoke ATG Rest API for Status of Order');
	var path = optionsGet.path;
	var status = false;
	path = path.replace('ID', session.userData.userInfo.orderInfo.orderId);
	optionsGet.path = path;
	var reqGet = http.request(optionsGet, function(res) {
	var orderJSON = "";
    console.log("statusCode: ", res.statusCode);
		res.on('data', function(d) {
			console.info('GET result:\n'+d);
			orderJSON = JSON.parse(d.toString());
		});
		res.on('end', function() {
			jsonRes(orderJSON);
		});
		res.on('error', function(e) {
			console.error(e);
		});
	}).end();
}

sendOrderStatus = function (session, args, jsonRes){
	var email = jsonRes.paymentResult[0].billingAddress.email;
	if(email == null){
		email = "";
	}
	var phone = jsonRes.paymentResult[0].billingAddress.phoneNumber;
	if(phone == null){
		phone = "";
	}
	var trackingNum = jsonRes.shippingResult[0].trackingNumber;
	var trackingURL = "";
	if(trackingNum != undefined && trackingNum!= null){
		trackingURL =  "http://www.fedex.com?trackingNum="+trackingNum;
	}else{
		trackingURL =  "http://www.fedex.com?trackingNum="+789876;
	}
	var totalItemCount = (jsonRes.result.totalCommerceItemCount).toString();
	var name = jsonRes.paymentResult[0].billingAddress.firstName + 
		" " + jsonRes.paymentResult[0].billingAddress.lastName;
	var orderId = jsonRes.result.id;
	var items = jsonRes.result.commerceItems;
	var paymentInfo = jsonRes.paymentResult[0].creditCardType +
		" ************" + jsonRes.paymentResult[0].creditCardNumber;
	var tax = jsonRes.result.priceInfo.tax;
	var total = jsonRes.result.priceInfo.total;
	var shipState = jsonRes.shippingResult[0].state;
	var total = (jsonRes.result.priceInfo.total).toString();
	total = total.substring(0, total.indexOf('.')+3);
	var today = new Date();
	var msg;
	if(shipState != undefined && shipState == 104){
		today.setDate(today.getDate() + 1);
		var stringDate = today.toDateString();
		msg = new builder.Message(session).addAttachment({
		contentType: "application/vnd.microsoft.card.adaptive",
		content: {
			"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
			"type": "AdaptiveCard",
			"version": "1.0",
			"body": [
					{
						"type": "Container",
						"items": [
							{
								"type": "TextBlock",
								"text": "Your Order Status",
								"weight": "bolder",
								"size": "medium"
							}
						]
					},
					{
						"type": "Container",
						"items": [
							{
								"type": "FactSet",
								"separator": true,
								"facts": [
									{
										"title": "Order Number",
										"value": orderId
									},
									{
										"title": "Full Name",
										"value": name
									},
									{
										"title": "Payment Type",
										"value": paymentInfo
									},
									{
										"title": "Order Total",
										"value": total
									},
									{
										"title": "Items",
										"value": totalItemCount
									},
									{
										"title": "Status",
										"value": "Shipped, On your way!"
									},
									{
										"title": "Tracking",
										"value": trackingURL
									},
									{
										"title": "Estimated Arrival",
										"value": stringDate
									},
									{
										"title": "Contact",
										"value": email + "/" + phone
									}
								]
							}
						]
					}
				]
			}
		});		
	}else{
		today.setDate(today.getDate() + 3);
		var stringDate = today.toDateString();
		console.log(stringDate);
		msg = new builder.Message(session).addAttachment({
		contentType: "application/vnd.microsoft.card.adaptive",
		content: {
			"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
			"type": "AdaptiveCard",
			"version": "1.0",
			"body": [
					{
						"type": "Container",
						"items": [
							{
								"type": "TextBlock",
								"text": "Your Order Status",
								"weight": "bolder",
								"size": "medium"
							}
						]
					},
					{
						"type": "Container",
						"items": [
							{
								"type": "FactSet",
								"separator": true,
								"facts": [
									{
										"title": "Order Number",
										"value": orderId
									},
									{
										"title": "Full Name",
										"value": name
									},
									{
										"title": "Payment Type",
										"value": paymentInfo
									},
									{
										"title": "Order Total",
										"value": total
									},
									{
										"title": "Items",
										"value": totalItemCount
									},
									{
										"title": "Status",
										"value": "Your Order is currently being processed!"
									},
									{
										"title": "Estimated Arrival",
										"value": stringDate
									},
									{
										"title": "Contact",
										"value": email + "/" + phone
									}
								]
							}
						]
					}
				]
			}
		});
	}
	
	session.send(msg);
}


performVerification = function(session, args){
	var orderId = builder.EntityRecognizer.findEntity(args.intent.entities, 'Order Id');
	var email = builder.EntityRecognizer.findEntity(args.intent.entities, 'builtin.email');
	var phoneNumber = builder.EntityRecognizer.findEntity(args.intent.entities, 'builtin.phonenumber');
	var performInfoExists = false;
	console.log("Args Intent:"+JSON.stringify(args.intent));
	console.log("Args Intent Entities:"+JSON.stringify(args.intent.entities));
	console.log("Session Email:"+email);
	if(orderId){
		console.log("Order Id", orderId.entity);
	}
	if(email){
		console.log("Email", email.entity);
	}
	if(phoneNumber){
		console.log("Phone Number", phoneNumber.entity);
	}
	
	if(orderId && orderId.entity ){
		session.userData.userInfo.orderInfo.orderId=orderId.entity;
	}
	if(email && email.entity){
		session.userData.userInfo.email=email.entity;
	}
	if(phoneNumber && phoneNumber.entity){
		session.userData.userInfo.phoneNumber=phoneNumber.entity;
	}

	if(!session.userData.userInfo){
		session.send('Can you proivde your email or phone number for verification');
	}

	if(session.userData.userInfo.orderInfo.orderId){
		session.send('Your Order Id  %s!', session.userData.userInfo.orderInfo.orderId);
		if(!session.userData.userInfo.email && !session.userData.userInfo.phoneNumber){
			session.send('Can you provide your email or phone number for verification');
		}else if(session.userData.userInfo.email){
			session.send('Thanks, I am verifying your details with your order');
			performInfoExists = true;
		}else if(session.userData.userInfo.phoneNumber){
			session.send('Thanks, I am verifying your details with your order');
			performInfoExists = true;
		}
	} else {
		session.send('Can you please provide your order number');
	}
	if(performInfoExists && session.userData.userInfo.orderInfo.orderId){
		return true;
	}else{
		return false;
	}
}