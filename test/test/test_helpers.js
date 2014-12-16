//
// test_helpers.js
// Jetstream
// 
// Copyright (c) 2014 Uber Technologies, Inc.
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

module.exports = {
    createTestUser: createTestUser,
    createTestMesssage: createTestMesssage,
    createTestChatRoom: createTestChatRoom
};

var ChatRoom = require('../../demos/chat').ChatRoom;
var Message = require('../../demos/chat').Message;
var User = require('../../demos/chat').User;

var userCount = 0;
function createTestUser() {
    var user = new User();
    user.username = 'chatmonster' + (++userCount);
    user.lastActive = new Date();
    return user;
}

var texts = ['Rarr', 'Hungry', 'Where are the cookies'];
function createTestMesssage(author) {
    var message = new Message();
    message.author = author;
    message.postedAt = new Date();
    message.text = texts[Math.floor((Math.random() * 3) + 1)];
    return message;
}

function createTestChatRoom() {
    var user = createTestUser();

    var chatRoom = new ChatRoom();
    chatRoom.name = 'TestChatRoom';
    chatRoom.users = [user];
    chatRoom.messages = [createTestMesssage(user)];
    return chatRoom;
}
