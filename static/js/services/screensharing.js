/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed WebRTC.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
define(['underscore', 'webrtc.adapter'], function(_) {

	// screensharing
	return ["$window", "$q", "chromeExtension", function($window, $q, chromeExtension) {

		var Screensharing = function() {
			this.autoinstall = false;
			this.initialize();
			chromeExtension.e.on("available", _.bind(function() {
				this.initialize();
			}, this));
		};

		Screensharing.prototype.initialize = function() {

			// Check if we can do screensharing.
			this.supported = false;

			// Define our helpers.
			this.prepare = null;
			this.cancel = null;

			// Chrome support.
			if ($window.webrtcDetectedBrowser === "chrome") {

				if ($window.webrtcDetectedVersion >= 32 &&
					$window.webrtcDetectedVersion < 37) {
					// Support for flag based developer screen sharing came in Chrome 32.
					// It was removed in Chrome 37 in favour of chrome.chooseDesktopMedia
					// https://code.google.com/p/chromium/issues/detail?id=347641
					this.supported = true;
					this.prepare = function(options) {
						// This generates constrains for the flag based screen screensharing
						// support in Chrome 31+ to 36. Flag to be enabled is found at:
						// chrome://flags/#enable-usermedia-screen-capture
						var d = $q.defer()
						var opts = _.extend({
							chromeMediaSource: "screen"
						}, options);
						d.resolve(opts);
						return d.promise;
					};
				} else if ($window.webrtcDetectedVersion >= 37) {
					// We need a extension to support screen sharing. See
					// https://developer.chrome.com/extensions/desktopCapture#method-chooseDesktopMedia
					// for details.
				}

				if (chromeExtension.available) {
					this.supported = true;
					var pending = null;
					this.prepare = function(options) {
						var select = chromeExtension.call({
							Type: "Action",
							Action: "chooseDesktopMedia"
						});
						var d = $q.defer();
						select.then(function(id) {
							// Success with id.
							pending = null;
							if (id) {
								var opts = _.extend({
									chromeMediaSource: "desktop",
									chromeMediaSourceId: id
								}, options);
								d.resolve(opts);
							} else {
								d.resolve(null);
							}
						}, function(err) {
							// Error.
							pending = null;
							console.log("Failed to prepare screensharing", err);
							d.reject(err);
						}, function(data) {
							// Notify.
							pending = data;
						});
						return d.promise;
					};
					this.cancel = function() {
						if (pending !== null) {
							chromeExtension.call({
								Type: "Action",
								Action: "cancelChooseDesktopMedia",
								Args: pending
							});
							pending = null;
						}
					};
				}

			} else {
				// Currently Chrome only - sorry.
				// Firefox 33 might get screen sharing support.
				// See https://bugzilla.mozilla.org/show_bug.cgi?id=923225
			}

			// Auto install support.
			if (!this.supported && chromeExtension.autoinstall.install) {
				this.supported = this.autoinstall = true;
				var that = this;
				this.prepare = function(options) {
					var d = $q.defer();
					var install = chromeExtension.autoinstall.install();
					install.then(function() {
						that.initialize();
						if (that.autoinstall) {
							// We are still on auto install - must have failed.
							d.reject("Auto install failed");
						} else {
							// Seems we can do it now.
							var prepare = that.prepare(options);
							prepare.then(function(id) {
								d.resolve(id);
							}, function(err) {
								d.reject(err);
							});
						}
					}, function(err) {
						d.reject(err);
					});
					return d.promise;
				};
				this.cancel = function() {
					if (chromeExtension.autoinstall.cancel) {
						chromeExtension.autoinstall.cancel();
					}
				};
			} else {
				this.autoinstall = false;
			}

			console.log("Screensharing support", this.supported, this.autoinstall ? "autoinstall" : "");

		};

		Screensharing.prototype.getScreen = function(options) {
			if (this.prepare) {
				return this.prepare(options);
			} else {
				var d = $q.defer()
				d.reject("No implementation to get screen.");
				return d.promise;
			}
		};

		Screensharing.prototype.cancelGetScreen = function() {
			if (this.cancel) {
				this.cancel();
			}
		};



		// Expose.
		var screensharing = new Screensharing();
		return screensharing;

	}];

});