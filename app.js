var restify = require('restify');
var builder = require('botbuilder');

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
			phoneNumber : ''
		};
		session.userData.userInfo = userInfo;
	}
	session.send('Welcome to the CSC Bot');
	var name = builder.EntityRecognizer.findEntity(args.intent.entities, 'Name');
	
	if(name != null){
		session.send('Hello  %s!', name.entity);
		session.send('Hi, I am Bot. How can I help you?');
	} else {
		session.send('Hi, I am Bot. How can I help you?');
	}
}).triggerAction({
	matches: 'Greet'
});

bot.dialog('Order Status', function (session, args, next) {
	
	console.log(session.userData.userInfo);
	var verified = performVerification(session, args);
	if(verified){
		session.send('We have sucessfuly verified your details');
		var status = sendOrderStatus(session,args);
		session.send(status);
	}

}).triggerAction({
	matches: 'Order Status'
});

sendOrderStatus = function (session, args){
	var msg = new builder.Message(session).addAttachment({
		contentType: "application/vnd.microsoft.card.adaptive",
		content: {
			type: "AdaptiveCard",
			body: [
				{
                        "type": "TextBlock",
                        "text": "You Order Details",
                        "size": "large",
                        "weight": "bolder"
					},
					{
                        "type": "TextBlock",
                        "text": "Order Number#"+ session.userData.userInfo.orderInfo.orderId
					},
					{
                        "type": "TextBlock",
                        "text": "Name, Balaji Sivakumar"
					},
					{
                        "type": "TextBlock",
                        "text": "Email: "+ session.userData.userInfo.email
                    },
                    {
                        "type": "TextBlock",
                         "text": "Mobile: "+ session.userData.userInfo.phoneNumber
                    },
                    {
                        "type": "TextBlock",
                         "text": "Order Status: Shipped, On your way!"
                    },
                    {
                        "type": "TextBlock",
                         "text": "Track your order, www.fedex.com?trackingNum=09879"
                    }
			]
		}
	});
	return msg;
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