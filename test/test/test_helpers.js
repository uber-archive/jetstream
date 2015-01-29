// Copyright (c) 2015 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
'use strict';

var ChatRoom = require('../../demos/chat').ChatRoom;
var ChatRoomAttributes = require('../../demos/chat').ChatRoomAttributes;
var Message = require('../../demos/chat').Message;
var User = require('../../demos/chat').User;

module.exports = {
    ChatRoom: ChatRoom,
    ChatRoomAttributes: ChatRoomAttributes,
    Message: Message,
    User: User,
    createTestUser: createTestUser,
    createTestMessage: createTestMessage,
    createTestChatRoom: createTestChatRoom
};

var arrayPropertyConstraint = require('../../').arrayPropertyConstraint;
var expr = require('../../').expr;
var hasNewValuePropertyConstraint = require('../../').hasNewValuePropertyConstraint;

// Test helper methods
var userCount = 0;
function createTestUser() {
    var user = new User();
    user.username = 'chatmonster' + (++userCount);
    user.lastActive = new Date();
    return user;
}

var texts = ['Rarr', 'Hungry', 'Where are the cookies'];
function createTestMessage(author) {
    var message = new Message();
    message.author = author;
    message.postedAt = new Date();
    message.text = texts[Math.floor((Math.random() * 3) + 1)];
    return message;
}

function createTestChatRoom() {
    var user = createTestUser();
    var attributes = new ChatRoomAttributes();
    attributes.topic = 'This is a test chat room';
    attributes.locale = 'en_US';

    var chatRoom = new ChatRoom();
    chatRoom.name = 'TestChatRoom';
    chatRoom.attributes = attributes;
    chatRoom.users = [user];
    chatRoom.messages = [createTestMessage(user)];
    return chatRoom;
}

// Add procedures for procedure testing
ChatRoom.defineProcedure('postMessage', {
    constraints: [
        {
            type: 'change',
            clsName: 'ChatRoom',
            properties: {
                messages: arrayPropertyConstraint({type: 'insert'})
            },
            allowAdditionalProperties: false
        },
        {
            type: 'add',
            clsName: 'Message',
            properties: {
                author: hasNewValuePropertyConstraint(),
                postedAt: hasNewValuePropertyConstraint(),
                text: hasNewValuePropertyConstraint()
            },
            allowAdditionalProperties: false
        }
    ],
    remote: {
        type: 'http',
        url: 'http://chatRoomAPI/room/:chatRoomUUID/messages',
        params: {
            chatRoomUUID: expr('$incoming.ChatRoom.change.uuid')
        },
        method: 'post',
        headers: {
            'Authorization': expr('$scope.params.accessToken'),
            'X-ChatRoom-Locale': expr('$rootModel.attributes.locale'),
            'X-ChatRoom-LastMessageId': expr('$incoming.ChatRoom.change.messages[-1]')
        },
        body: {
            uuid: expr('$incoming.Message.add.uuid'),
            authorUUID: expr('$incoming.Message.add.author'),
            postedAt: expr('$incoming.Message.add.postedAt'),
            text: expr('$incoming.Message.add.text'),
            tags: ['staticValue0', 'staticValue1']
        }
    }
});
