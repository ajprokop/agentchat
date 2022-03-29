$(document).ready(init);

function init() {
	clearAllChats()
	$('#message').prop("readonly", true);
	$('#sendMsg').prop("disabled", true);
	document.getElementById("connect").innerHTML = "Connect";
	checkQueryParameters()
}
var spacesToken;
var socketURL = "https://spacesapis-socket.avayacloud.com/chat";
var spaceId;
var socketio = "";
var password;

var input = document.getElementById("message");
input.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
   event.preventDefault();
   document.getElementById("sendMsg").click();
  }
});

function connectSocket() {
	socketio = io.connect(socketURL, {
		query: 'tokenType=jwt&token=' + spacesToken,
		transports: ['websocket']
	});
	socketio.on('connect', function() {
		var spaceToSubscribe = {
			channel: {
				_id: spaceId,
				type: 'topic',
				password: password
			}
		};
		socketio.emit('SUBSCRIBE_CHANNEL', spaceToSubscribe);
		document.getElementById("connect").innerHTML = "Disconnect";
	});
	socketio.on('disconnect', function() {
		console.log("Socket disconnect");
	});
	socketio.on('connect_error', function() {
		console.log("Socket connect_error");
	});
	socketio.on('error', function() {
		console.log("Socket error");
	});
	socketio.on('CHANNEL_SUBSCRIBED', function() {
		$('#sendMsg').prop("disabled", false);
		$('#message').prop("readonly", false);
	});
	socketio.on('CHANNEL_UNSUBSCRIBED', function() {
		console.log("CHANNEL_UNSUBSCRIBED");
	});
	socketio.on('SUBSCRIBE_CHANNEL_FAILED', function() {
		console.log("SUBSCRIBE_CHANNEL_FAILED");
	});
	socketio.on('SEND_MESSAGE_FAILED', function(msg) {
		console.log("SEND_MESSAGE_FAILED");
	});
	socketio.on('MESSAGE_SENT', function(msg) {
		console.log(msg.category);
		var category = msg.category;
		var message;
		var description;
		var strLength;
		if(category == "chat") {
			message = msg.content.bodyText.replace(/<(.|\n)*?>/g, '');
			if(msg.content.data !== undefined) {
				if(msg.content.data.length > 0) {
					message = msg.sender.displayname + ": " + msg.content.data[0].name + " " + msg.content.data[0].path;
					writeToTrace(message);
					return;
				}
			}
			message = msg.sender.displayname + ": " + message;
			writeToTrace(message);
		}
	});
}

function sendMsg() {
	var message = {
		content: {
			bodyText: $('#message').val()
		},
		sender: {
			type: 'user'
		},
		category: 'chat',
		topicId: spaceId
	};
	socketio.emit('SEND_MESSAGE', message);
	document.getElementById('message').value = "";
}

function clearAllChats() {
		var consoleTxt = $('#console-log').val();
		$('#console-log').val("");
		$("#console-log span").remove();		
}

function disconnect() {
	var spaceToUnsubscribe = {
		channel: {
			_id: spaceId,
			type: 'topic',
			password: password
		}
	};
	socketio.emit('UNSUBSCRIBE_CHANNEL', spaceToUnsubscribe);
	init();
	socketio = null;
}

function startConnect() {
	if(document.getElementById("connect").innerHTML == "Disconnect") {
		disconnect();
		return;
	}
	// Create an anonymous user in order to obtain a jwt token
	$.ajax({
		data: JSON.stringify({
			"displayname": document.getElementById("userChat").value,
			"username": document.getElementById("userChat").value
		}),
		url: "https://spacesapis.avayacloud.com/api/anonymous/auth",
		contentType: 'application/json',
		type: 'POST',
		success: function(data) {
			spacesToken = data.token;
			joinRoom();
			connectSocket();
		},
		error: function(error) {}
	});
}

function joinRoom() {
	// Join the space
	$.ajax({
		headers: {
			'Authorization': 'jwt ' + spacesToken,
			'Accept': 'application/json',
			'spaces-x-space-password': password
		},
		url: 'https://spacesapis.avayacloud.com/api/spaces/' + spaceId + '/join',
		type: "GET",
		success: function(data) {
			console.log("Room joined");
			console.dir(data);
		}
	});
}

function writeToTrace(text) {
	text = text.trim();
	addToConsole(text);
}

function addToConsole(msg) {
	var span = createLogElement(msg);
	$('#console-log').append(span);
	document.getElementById("console-log").scrollTop = document.getElementById("console-log").scrollHeight;
}

function createLogElement(msg) {
	var span = document.createElement('span');
	$(span).addClass('log-element');
	var msgArray = msg.split(':');
	var sender = msgArray[0];
	var restMsg = "";
	for(var i = 1; i < msgArray.length; i++) {
		if(i == 1) {
			restMsg += " " + msgArray[i];
		} else {
			restMsg += ":" + msgArray[i];
		}
	}
	var sendSpan = document.createElement('span');
	$(sendSpan).addClass('log-element-sender');
	sendSpan.innerHTML = sender + ":";
	var msgSpan = document.createElement('span');
	$(msgSpan).addClass('log-element-msg');
	$(msgSpan).append(messageWithLink(restMsg));
	$(span).append(sendSpan);
	$(span).append(msgSpan);
	return span;
}

function messageWithLink(msg) {
	if(!msg) {
		return msg;
	}
	var matches = msg.match(/[(http(s)?):\/\/(www\.)?a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
	if(matches) {
		for(var i = 0; i < matches.length; i++) {
			if(matches[i].toLowerCase().indexOf("http") != -1) { // Don't hyperlink the file name
				if(matches.length > 1) {
					// The user is uploading a file
					msg = msg.replace(matches[i], '<a href = "' + matches[i] + '" target = "_blank"><img src="./images/download.png" alt="Open/Download" style="width:42px;height:42px;"></a>'); //target = '_blank' says to open in new tab or window			
				} else {
					// The user put a link into the chat window
					msg = msg.replace(matches[i], '<a href = "' + matches[i] + '" target = "_blank">' + matches[i] + ' ' + '<img src="./images/download.png" alt="Open/Download" style="width:42px;height:42px;"></a>');
				}
			}
		}
	}
	return msg;
}

function checkQueryParameters() {
	const urlParams = new URLSearchParams(window.location.search);
	var room = urlParams.get('room');
	if(room) {
		spaceId = room;
	}
	var name = urlParams.get('name');
	if(name) {
		document.getElementById("userChat").innerHTML = name;
	}
}