/* global Module */

/* MMM-MinecraftStatus.js
 *
 * Magic Mirror
 * Module: MMM-MinecraftStatus
 * MIT Licensed.
 *
 * See README.md for details on this.
 */
Module.register("MMM-MinecraftStatus", {

    defaults: {
        banner: "Minecraft Server",
        hostname: "localhost",
        port: 12345,
        intervalSeconds: 30
    },


    getStyles: function() {
        return [ "MMM-MinecraftStatus.css", 'font-awesome.css' ];
    },


    /*
     * Don't hate, these came from Google translate.  If you don't like them, send
     * a pull request on Github, please!
     */
	getTranslations: function() {
		return {
            cn: "translations/cn.json",
            de: "translations/de.json",
			en: "translations/en.json",
            es: "translations/es.json",
			fr: "translations/fr.json",
            it: "translations/it.json",
            jp: "translations/jp.json",
            ru: "translations/ru.json"
		};
	},


    /*
     * OVERRIDES parent function.  Called when MM wants to draw this widget on the browser
     * page's DOM.
     * This creates "this.playersDiv" and "this.latencyDiv" for use below in function
     * socketNotificationReceived that overwrites their HTML with whatever the server
     * (node_helper.js) sends back from Minecraft.
     */
    getDom: function() {
        var  topDiv = this.createEle(null,  "div", "minecraftStatus");
        this.createEle(topDiv, "div", "title", this.config.banner);
        var table = this.createEle(topDiv, "table");
        var tbody = this.createEle(table, "tbody");
        this.playersDiv = this.createMetricPanel(tbody, "user",    this.translate("players"));
        this.latencyDiv = this.createMetricPanel(tbody, "clock-o", this.translate("latency"));
        return topDiv;
    },


    /*
     * Helper method called exclusively by getDom() above.  This draws either the
     * Players row with icon and number, or the Latency row with number and icon.
     */
    createMetricPanel: function(parent, fontAwesomeName, label) {
        var row = this.createEle(parent, "tr");
        this.createEle(row, "td", "iconbox",
                       "<i class='fa fa-" + fontAwesomeName + " fa-fw'></i>");

        var value = this.createEle(row, "td", "value", "?");
        this.createEle(row, "td", "label", label);
        return value;
    },


    /*
     * Create a single HTML Element (something with < and > around it and children
     * html things).
     */
    createEle: function(parentEle, eleType, name, innerHtml) {
        var div = document.createElement(eleType);
        if (name)      div.className = name;
        if (innerHtml) div.innerHTML = innerHtml;
        if (parentEle) parentEle.appendChild(div);
        return div;
    },


    /*
     * OVERRIDES notificationReceived() from parent.
     * This handles the DOM_OBJECTS_CREATED in-browser message sent from MagicMirror.
     * This single alert is sent (delivered to) every widget so they can take actions
     * once the MM screen is setup and available, and after getDom() has been called
     * on every module.
     * we respond to this event here by starting the recurring timeer that will issue
     * pings, and not before: if the response from the server-side helper arrives before
     * getDom() was done (or before getDom() was invoked!), there would be no elements
     * on the browser matching that needs to be present.
     */
    notificationReceived: function(notification, payload, sender) {
        switch(notification) {
            case "DOM_OBJECTS_CREATED":
                this.triggerHelper();     // Ask the server-side helper right away
                this.startTimer();        // wake up every once and a while and try again
                break;
        }
    },


    /*
     * Send a message to our node_helper.js, running on the server.  Tell it that it is time
     * to query a Minecraft server.  This isn't a round-trip event where we ask the server.
     * It is a notification from us to the node_helper.  When and if the helper completes,
     * we hope it will deliver a push message to us that we can react to.
     * Because of the nature of send and receive socket notification functions, our reuquest
     * is delivered to our node_helper, but there could be multiple instances of this mod
     * running on different browsers.  We pass this.identifier to the server, so the server
     * can send it back in th response.  This way, each instance of MMM-MinecraftStatus
     * object will know to which of them a message pertains.
     */
    triggerHelper: function() {
        //mclog("Asking server to mcping " + this.config.hostname + ":" + this.config.port);
        this.sendSocketNotification("MINECRAFT_PING", {
            identifier: this.identifier,      // sent to helper and sent back to us below
            hostname:   this.config.hostname,
            port:       this.config.port
        });
    },


    /*
     * Create a single timer for this module that fires on a cadence.  Each "tick",
     * call triggerHelper().  This sends a message to our node_helper.js code on the
     * server with the host and port to MinecraftPing.  Nothing waits for a reply here,
     * this function ends immediately.  The server sends results to us asynchronously.
     * Just to be safe in case something gets really out of sync, this won't start
     * a timer if there is already one running in this module.
     */
    startTimer: function() {
        var self = this; // "this" means something else in the setInterval() function below
        if (! this.timer) {
            this.timer = setInterval(
                function() { self.triggerHelper(); }, // "self" is "this" for MMM-MinecraftStatus object
                self.config.intervalSeconds * 1000    // setInterval() runs in milliseconds
            );
            //this.mclog("Now watching server " + this.config.hostname + ":" + this.config.port);
        }
    },


    /*
     * Callback function invoked by MagicMirror whenever our node_helper.js sends a message.
     * NOTE: it's up to us to be careful, since there is one node_helper.js running on the
     * server, but there could be many instances of us running in the browser (we could be
     * watching multiple Minecraft servers).  This function only takes action if the message
     * sent from the helper has the same intended "this.identifier" as us: we send in our
     * identifier in triggerHelper() above.
     */
    socketNotificationReceived: function(notification, payload) {
        // this.mclog("Got " + notification + ": " +
        //             JSON.stringify(payload, null, 2));
        if (payload.identifier === this.identifier) {
            switch(notification) {
                case "MINECRAFT_UPDATE":
                    this.playersDiv.innerHTML = payload.players;
                    this.latencyDiv.innerHTML = payload.latency;
                    break;

                case "MINECRAFT_ERROR":
                    this.playersDiv.innerHTML = "!";
                    this.latencyDiv.innerHTML = "!";
                    this.sendNotification("SHOW_ALERT", { // picked-up by default module "alert"
                        type: "notification",
                        title: this.config.banner,
                        message: payload.message
                    });
                    break;
            }
        }
    },


    /*
     * Callback function invoked by MagicMirror whenever we are removed from the screen
     * visually.  When we're not visible, there isn't really a reason for us to continue
     * pinging the Minecraft server.  Stop the timer here so we go "idle" for the time-being.
     */
    suspend: function() {
        if (!!this.timer) {
             clearInterval(this.timer);
             this.timer = null;
             //this.mclog("Not watching a server anymore");
         }
    },


    /*
     * Callback function invoked by MagicMirror whenever we were suspended and are now
     * visible again: turn the timer back on.  Since the timer will wait a while before
     * triggering the helper, force-trigger it now so the user gets an update quickly.
     */
    resume: function() {
        this.triggerHelper();
        this.startTimer();
    }
});
