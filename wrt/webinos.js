/*******************************************************************************
 *  Code contributed to the webinos project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
 ******************************************************************************/
(function () {
    var channel = null;

    var _console = function(type,args){
        if(typeof module === 'undefined' && type === "log" && (typeof webinos === 'undefined' || typeof webinos.logging != 'function' || !webinos.logging())) {
            return;
        }
        (console[type]).apply(console,args);
    }
    var logger = {
        log:function(){_console("log",arguments)},
        info:function(){_console("info",arguments)},
        warn:function(){_console("warn",arguments)},
        error:function(){_console("error",arguments)},
        debug:function(){_console("debug",arguments)}
    };

    /**
     * Creates the socket communication channel
     * for a locally hosted websocket server at port 8080
     * for now this channel is used for sending RPC, later the webinos
     * messaging/eventing system will be used
     */
    function createCommChannel (successCB) {
        var channel = null;
        if (typeof WebinosSocket !== 'undefined') { // Check if we are inside Android widget renderer.
            channel = new WebinosSocket ();
        } else { // We are not in Android widget renderer so we can use a browser websocket.
            var port, hostname;
            var defaultHost = "localhost";
            var defaultPort = "8080";
            var isWebServer = true;
            var useDefaultHost = false;
            var useDefaultPort = false;

            // Get web server info.

            // Get web server port.
            port = window.location.port - 0 || 80;
            // Find web server hostname.
            hostname = window.location.hostname;
            if (hostname == "") isWebServer = false; // We are inside a local file.
            if(hostname !== "localhost" && hostname !=="127.0.0.1") {
            logger.log("websocket connection is only possible with address localhost or 127.0.0.1. Please change to localhost or 127.0.0.1 " +
                  "to connect to the PZP");
            }

            // Find out the communication socket info.

            // Set the communication channel's port.
            if (isWebServer) {
                try {
                    var xmlhttp = new XMLHttpRequest ();
                    xmlhttp.open ("GET", "/webinosConfig.json", false);
                    xmlhttp.send ();
                    if (xmlhttp.status == 200) {
                        var resp = JSON.parse (xmlhttp.responseText);
                        port = resp.websocketPort;
                    } else { // We are not inside a pzp or widget server.
                        logger.log ("CAUTION: webinosConfig.json failed to load. Are you on a pzp/widget server or older version of webinos? Trying the guess  communication channel's port.");
                        port = port + 1; // Guessing that the port is +1 to the webserver's. This was the way to detect it on old versions of pzp.
                    }
                } catch (err) { // XMLHttpRequest is not supported or something went wrong with it.
                    logger.log ("CAUTION: The pzp communication host and port are unknown. Trying the default communication channel.");
                    useDefaultHost = true;
                    useDefaultPort = true;
                }
            } else { // Let's try the default pzp hostname and port.
                logger.log ("CAUTION: No web server detected. Using a local file? Trying the default communication channel.");
                useDefaultHost = true;
                useDefaultPort = true;
            }
            // Change the hostname to the default if required.
            if (useDefaultHost) hostname = defaultHost;
            // Change the port to the default if required.
            if (useDefaultPort) port = defaultPort;

            // We are ready to make the connection.

            // Get the correct websocket object.
            var ws = window.WebSocket || window.MozWebSocket;
            try {
//                channel = new ws ("ws://" + hostname + ":" + port);
              channel = new ws ("ws://" + hostname);
            } catch (err) { // Websockets are not available for this browser. We need to investigate in order to support it.
                throw new Error ("Your browser does not support websockets. Please report your browser on webinos.org.");
            }
        }
        webinos.session.setChannel (channel);
        webinos.session.setPzpPort (port);

        channel.onmessage = function (ev) {
            logger.log ('WebSocket Client: Message Received : ' + JSON.stringify (ev.data));
            var data = JSON.parse (ev.data);
            if (data.type === "prop") {
                webinos.session.handleMsg (data);
            } else {
                //webinos.messageHandler.setOwnSessionId (webinos.session.getSessionId ());
                //webinos.messageHandler.setSendMessage (webinos.session.message_send_messaging);
                webinos.messageHandler.onMessageReceived (data, data.to);
            }
        };
        channel.onopen = function() {
          var url = window.location.pathname;
          var origin = window.location.origin;
          webinos.session.message_send({type: 'prop', payload: {status:'registerBrowser', value: url, origin: origin}});
        };
        channel.onerror = function(evt) {
          console.error("WebSocket error", evt);
          webinos.session.setChannel(null);
          setTimeout(createCommChannel,10000);
        };
    }

    createCommChannel ();

    webinos.rpcHandler = new RPCHandler (undefined, new Registry ());
    webinos.messageHandler = new MessageHandler (webinos.rpcHandler);

} ());
