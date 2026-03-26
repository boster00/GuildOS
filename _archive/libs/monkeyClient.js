// ARCHIVED: Original path was libs/monkeyClient.js

"use client";
import React, { useState, useEffect } from "react";
class MonkeyClient {
    // Add methods and properties as needed
    
    constructor() {
        this.states = {};
        this.callbacks = {};
        this.cjbutton = this.cjbutton.bind(this);
        this.apiCall = this.apiCall.bind(this);
        console.log("MonkeyClient->constructor called, new instance created");
    }
    feedBanana(banana) {
        Object.assign(this, { ...banana });
    }
    initState(stateName,initialStateValue) {
        console.log("Initializing state, should be fresh, or has memory??", stateName,initialStateValue,this.states);
        if (!this.states) this.states = {};
        const setState = this.formatSetStateName(stateName);
        [this.states[stateName], this.states[setState]] = useState(initialStateValue);
    }
    async cjbutton(e){
        const tar=e.target;
        const requiredAttrs = ["url", "action", "data"];
        let missing = requiredAttrs.filter(attr => !tar.hasAttribute(attr));
        if (missing.length > 0) {
            console.error("Missing required attributes:", missing.join(", "));
            return;
        }
        const url = tar.getAttribute("url");
        const action = tar.getAttribute("action");
        const data = tar.getAttribute("data");
        const destination = tar.hasAttribute("destination") ? tar.getAttribute("destination") : null;
        let callbackFunction = null;
        if (tar.hasAttribute("callbackFunction")) {
            callbackFunction = tar.getAttribute("callbackFunction");
        } else if (tar.hasAttribute("callback")) {
            callbackFunction = tar.getAttribute("callback");
        }
        const response = await this.apiCall(url, data);
        if (destination && this.states.hasOwnProperty(destination)) {
            const setStateName = this.formatSetStateName(destination);
            if (typeof this.states[setStateName] === "function") {
                this.states[setStateName](response);
            }
        }
        if (callbackFunction && this.callbacks.hasOwnProperty(callbackFunction)) {
            this.callbacks[callbackFunction](response);
        }

    }
    async apiCall(url, data) {
        if (typeof data === "string" && this.states && this.states[data] !== undefined) {
            data = this.states[data];
        }
        try {
            const { initMonkey } = await import("@/libs/monkey");
            const monkey = await initMonkey();
            return await monkey.apiCall(url, data);
        } catch (err) {
            console.error("API Call Error:", err);
            throw err;
        }
    }
    formatSetStateName(stateName) {
        return "set" + stateName.charAt(0).toUpperCase() + stateName.slice(1);
    }

}

const monkeyClient = new MonkeyClient();

export default monkeyClient;