/**
 * Simple, lightweight, usable local autocomplete library for modern browsers
 * Because there weren’t enough autocomplete scripts in the world? Because I’m completely insane and have NIH syndrome? Probably both. :P
 * @author Lea Verou http://leaverou.github.io/awesomplete
 * MIT license
 */

(function () {

var _ = function (input, o) {
	var me = this;

	// Setup

	this.input = $(input);
	this.input.setAttribute("autocomplete", "nope");
	this.input.setAttribute("aria-autocomplete", "list");

	o = o || {};

	configure(this, {
		minChars: 2,
		maxItems: 10,
		autoFirst: false,
		data: _.DATA,
		filter: _.FILTER_CONTAINS,
		sort: _.SORT_BYLENGTH,
		item: _.ITEM,
		replace: _.REPLACE,
		backend: false
	}, o);

	this.index = -1;

	// Create necessary elements

	this.container = $.create("div", {
		className: "awesomplete",
		around: input
	});

	this.ul = $.create("ul", {
		hidden: "hidden",
		inside: this.container
	});

	this.status = $.create("span", {
		className: "visually-hidden",
		role: "status",
		"aria-live": "assertive",
		"aria-relevant": "additions",
		inside: this.container
	});

	// Bind events

	var keydown = function(evt) {
		var c = evt.keyCode;
		if (c == null) {
			return;
		}

		// If the dropdown `ul` is in view, then act on keydown for the following keys:
		// Enter / Esc / Up / Down
		// console.log('opened', me.opened, (c === 38 || c === 40))
		if(me.opened) {
			if (c === 13 && me.selected) { // Enter
				evt.preventDefault();
				me.select();
			}
			else if (c === 27) { // Esc
				me.close({ reason: "esc" });
			}
			else if (c === 38 || c === 40) { // Down/Up arrow
				evt.preventDefault();
				me[c === 38? "previous" : "next"]();
			}
		}
	}
	this.keydown = keydown;

	$.bind(this.input, {
		"input": this.evaluate.bind(this),
		"blur": this.close.bind(this, { reason: "blur" }),
		"keydown": function(evt) {
			keydown(evt);
		}
	});

	$.bind(this.input.form, {"submit": this.close.bind(this, { reason: "submit" })});

	$.bind(this.ul, {"mousedown": function(evt) {
		var li = evt.target;

		if (li !== this) {

			while (li && !/li/i.test(li.nodeName)) {
				li = li.parentNode;
			}

			if (li && evt.button === 0) {  // Only select on left click
				evt.preventDefault();
				me.select(li, evt.target);
			}
		}
	}});

	if (this.input.hasAttribute("list")) {
		this.list = "#" + this.input.getAttribute("list");
		this.input.removeAttribute("list");
	}
	else {
		this.list = this.input.getAttribute("data-list") || o.list || [];
	}

	_.all.push(this);
};

var evaluateTimeout;
var evaluateBufferTime = 250; // Prevents slowing down while typing

function isFunction(functionToCheck) {
 var getType = {};
 return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

_.prototype = {
	set list(list) {
		if (Array.isArray(list)) {
			this._list = list;
		} else if (typeof list === "string" && list.indexOf(",") > -1) {
			this._list = list.split(/\s*,\s*/);
		} else if (isFunction(list)) {
			this._list = list;
		} else { // Element or CSS selector
			list = $(list);

			if (list && list.children) {
				var items = [];
				slice.apply(list.children).forEach(function (el) {
					if (!el.disabled) {
						var text = el.textContent.trim();
						var value = el.value || text;
						var label = el.label || text;
						if (value !== "") {
							items.push({ label: label, value: value });
						}
					}
				});
				this._list = items;
			}
		}
		// if (this.opened) {
		// 	this.evaluate();
		// }

		if (this.opened && document.activeElement === this.input) {
			this.evaluate();
		}
	},

	get selected() {
		return this.index > -1;
	},

	get opened() {
		return !this.ul.hasAttribute("hidden");
	},

	close: function (o) {
		if (!this.opened) {
			return;
		}

		this.ul.setAttribute("hidden", "");
		this.index = -1;

		$.fire(this.input, "awesomplete-close", o || {});
	},

	open: function () {
		this.ul.removeAttribute("hidden");

		if (this.autoFirst && this.index === -1) {
			this.goto(0);
		}

		$.fire(this.input, "awesomplete-open");
	},

	next: function () {
		var count = this.ul.children.length;

		this.goto(this.index < count - 1? this.index + 1 : -1);
	},

	previous: function () {
		var count = this.ul.children.length;

		this.goto(this.selected? this.index - 1 : count - 1);
	},

	// Should not be used, highlights specific item without any checks!
	goto: function (i) {
		var lis = this.ul.children;

		if (this.selected) {
			lis[this.index].setAttribute("aria-selected", "false");
		}

		this.index = i;

		if (i > -1 && lis.length > 0) {
			lis[i].setAttribute("aria-selected", "true");
			this.status.textContent = lis[i].textContent;

			$.fire(this.input, "awesomplete-highlight", {
				text: this.suggestions[this.index]
			});
		}
	},

	select: function (selected, origin) {
		if (selected) {
			this.index = $.siblingIndex(selected);
		} else {
			selected = this.ul.children[this.index];
		}

		if (selected) {
			var suggestion = this.suggestions[this.index];

			var allowed = $.fire(this.input, "awesomplete-select", {
				text: suggestion,
				origin: origin || selected
			});

			if (allowed) {
				this.replace(suggestion);
				this.close({ reason: "select" });
				$.fire(this.input, "awesomplete-selectcomplete", {
					text: suggestion
				});
			}
		}
	},

	evaluate: function() {
		var value = this.input.value;
		if (evaluateTimeout != null) {
			clearTimeout(evaluateTimeout);
		}

		if (this.backend) {
			return (function(that) {
				that.index = -1;

				var tracker = getTracker('awesomeplete search').step();

				vph.search({ 
					value: value, 
					list: that.backend, 
					minChars: that.minChars, 
					maxItems: that.maxItems
				}, function(suggestions) {
					if (suggestions == 'empty response') {
						return that.close({ reason: "nomatches" });
					}
					if (isDone(tracker)) return;

					that.suggestions = suggestions;

					that.ul.innerHTML = "";

					that.suggestions.forEach(function(data) {
						var text = new Suggestion(data);
						that.ul.appendChild(that.item(text, value));
					});

					if (that.ul.children.length === 0) {
						that.close({ reason: "nomatches" });
					} else {
						that.open();
					}

				})
			})(this);
		}

		this.evalNum = this.evalNum != null ? this.evalNum : 1;
		this.evalNum++;
		evaluateTimeout = setTimeout((function(that) {
			return function() {
				var me = that;
				var value = that.input.value;
				var startNum = that.evalNum;

				if (value.length >= that.minChars && (isFunction(that._list) || that._list.length > 0)) {
					that.index = -1;
					
					var opts = {};
					if (me.opts != null) {
						for (var key in me.opts) {
							opts[key] = me.opts[key];
						}
					}

					var after = function() {
						if (that.input.value != value) return; // Missed it

						// Populate list with options that match
						that.ul.innerHTML = "";
			
						that.suggestions.forEach(function(text) {
							me.ul.appendChild(me.item(text, value));
						});

						if (that.ul.children.length === 0) {
							that.close({ reason: "nomatches" });
						} else {
							that.open();
						}
					}

					if (isFunction(that._list)) {
						that.suggestions = that._list(value);
						after();
					} else {

						that.suggestions = that._list
							.map(function(item) {
								return new Suggestion(me.data(item, value));
							})
							.filter(function(item) {
								return me.filter(item, value, opts);
							});

						// A better way than sorting everything if you know what the max num you are looking for is.
						var sortFunc = that.sort(value, opts);

						// var searchTimer = new timeSpan('search ' + value);

						var results = [];
						lastItemScore = 0;
						if (startNum < that.evalNum) return;
						// blockThreshold: 100
						that.suggestions.map(function(suggestion, done) {
							if (startNum < that.evalNum) return;
							if (results.length < that.maxItems || sortFunc(suggestion) > lastItemScore) {
								results.push(suggestion);
								
								if (results.length > that.maxItems * 2) {
									// space out the sorting for efficiency sake
									results = results.sort(sortFunc).slice(0, that.maxItems);
									lastItemScore = sortFunc(results[results.length-1])
								}
							}
						});

						if (startNum < that.evalNum) return;

						// searchTimer.done();

						results = results.sort(sortFunc).slice(0, that.maxItems);
						that.suggestions = results;
						after();

						// .sort(that.sort(value, opts))
						// .slice(0, that.maxItems);
					}
						/**
						(function(value) {
							var opts = {};
							if (me.opts != null) {
								for (var key in me.opts) {
									opts[key] = me.opts[key];
								}
							}
							return me.sort(value, opts)(value);
						})(value)
						**/
				} else {
					that.close({ reason: "nomatches" });
				}
			};
		})(this), evaluateBufferTime * (this.input.value.length < 2 ? 2 : 1)); // Wait twice as long for the first few.
		
	}
};

// Static methods/properties

_.all = [];

_.FILTER_CONTAINS = function (text, input) {
	return RegExp($.regExpEscape(input.trim()), "i").test(text);
};

_.FILTER_STARTSWITH = function (text, input) {
	return RegExp("^" + $.regExpEscape(input.trim()), "i").test(text);
};

_.SORT_BYLENGTH = function(value) {
	return function (a, b) {
		if (b == null) return a.length;

		if (a.length !== b.length) {
			return a.length - b.length;
		}

		return a < b? -1 : 1;
	};
};

_.ITEM = function (text, input) {
	var html = input === '' ? text : text.replace(RegExp($.regExpEscape(input.trim()), "gi"), "<span>$&</span>");
	return $.create("li", {
		innerHTML: html,
		"aria-selected": "false"
	});
};

_.REPLACE = function (text) {
	this.input.value = text.value;
};

_.DATA = function (item/*, input*/) { return item; };

// Private functions

function Suggestion(data) {
	var o = Array.isArray(data)
	  ? { label: data[0], value: data[1] }
	  : typeof data === "object" && "label" in data && "value" in data ? data : { label: data, value: data };

	this.label = o.label || o.value;
	this.value = o.value;
}
Object.defineProperty(Suggestion.prototype = Object.create(String.prototype), "length", {
	get: function() { return this.label.length; }
});
Suggestion.prototype.toString = Suggestion.prototype.valueOf = function () {
	return "" + this.label;
};

function configure(instance, properties, o) {
	for (var i in properties) {
		var initial = properties[i],
		    attrValue = instance.input.getAttribute("data-" + i.toLowerCase());

		if (typeof initial === "number") {
			instance[i] = parseInt(attrValue);
		}
		else if (initial === false) { // Boolean options must be false by default anyway
			instance[i] = attrValue !== null;
		}
		else if (initial instanceof Function) {
			instance[i] = null;
		}
		else {
			instance[i] = attrValue;
		}

		if (!instance[i] && instance[i] !== 0) {
			instance[i] = (i in o)? o[i] : initial;
		}
	}
}

// Helpers

var slice = Array.prototype.slice;

function $(expr, con) {
	return typeof expr === "string"? (con || document).querySelector(expr) : expr || null;
}

function $$(expr, con) {
	return slice.call((con || document).querySelectorAll(expr));
}

$.create = function(tag, o) {
	var element = document.createElement(tag);

	for (var i in o) {
		var val = o[i];

		if (i === "inside") {
			$(val).appendChild(element);
		}
		else if (i === "around") {
			var ref = $(val);
			ref.parentNode.insertBefore(element, ref);
			element.appendChild(ref);
		}
		else if (i in element) {
			element[i] = val;
		}
		else {
			element.setAttribute(i, val);
		}
	}

	return element;
};

$.bind = function(element, o) {
	if (element) {
		for (var event in o) {
			var callback = o[event];

			event.split(/\s+/).forEach(function (event) {
				element.addEventListener(event, callback);
			});
		}
	}
};

$.fire = function(target, type, properties) {
	var evt = document.createEvent("HTMLEvents");

	evt.initEvent(type, true, true );

	for (var j in properties) {
		evt[j] = properties[j];
	}

	return target.dispatchEvent(evt);
};

$.regExpEscape = function (s) {
	return s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
};

$.siblingIndex = function (el) {
	/* eslint-disable no-cond-assign */
	for (var i = 0; el = el.previousElementSibling; i++);
	return i;
};

// Initialization

function init() {
	$$("input.awesomplete").forEach(function (input) {
		new _(input);
	});
}

// Are we in a browser? Check for Document constructor
if (typeof Document !== "undefined") {
	// DOM already loaded?
	if (document.readyState !== "loading") {
		init();
	}
	else {
		// Wait for it
		document.addEventListener("DOMContentLoaded", init);
	}
}

_.$ = $;
_.$$ = $$;

// Make sure to export Awesomplete on self when in a browser
if (typeof self !== "undefined") {
	self.Awesomplete = _;
}

// Expose Awesomplete as a CJS module
if (typeof module === "object" && module.exports) {
	module.exports = _;
}

return _;

}());
