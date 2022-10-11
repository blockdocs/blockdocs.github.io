var runningInBrowser = !(typeof window === 'undefined') || !(typeof webWorker === 'undefined');
if (runningInBrowser) {
  Error.stackTraceLimit = Infinity;
  module = {exports: {}};
} else {
  var _ = require('lodash');
}

var day = 1000 * 60 * 60 * 24;
 
var getKey = function(obj, key, default_val) {
  if (obj[key] == null) obj[key] = default_val;
  return obj[key];
}
module.exports.getKey = getKey;

var isFunction = function(el) {
  return typeof el === "function";
};
module.exports.isFunction = isFunction;

var makeDate = function(obj, opts) {
  opts = opts || {};

  var hours = obj.getHours();
  var minutes = obj.getMinutes();
  var ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0'+minutes : minutes;
  var strTime = hours + ':' + minutes + ' ' + ampm;
  return (obj.getMonth() + 1) + '/' + (obj.getDate()) + '/' + (obj.getYear() + 1900) + (opts.hours ? ' ' + strTime : '');
}
module.exports.makeDate = makeDate;

var empty = function(obj) {
  return obj == null || Object.keys(obj).length == 0;
};
module.exports.empty = empty;

var trackerCount = {};
var getTracker = function(title, opts) {
  opts = opts || {};
  if (trackerCount[title] == null) trackerCount[title] = 0;

  var tracker = { start: trackerCount[title], title: title, conditions: opts.conditions || [] };

  tracker.step = function() {
    trackerCount[title]++;
    return getTracker(title);
  };

  return tracker;
}
module.exports.getTracker = getTracker;

var isDone = function(tracker) {
  if (tracker == null) return false;
  return trackerCount[tracker.title] > tracker.start || tracker.conditions.some(function(condition) {
    return isDone(condition);
  });
};
module.exports.isDone = isDone;

var for2 = function(opts, func, callback) {
  opts = opts || {}
  
  var done = callback || opts.done || function() {};
  var finished = false;
  var tracker = opts.track;

  if (opts.list == null) return callback;
  var values = opts.list.length != null ? opts.list :  _.values(opts.list);
  var keys = opts.list.length != null ? range(0, opts.list.length) : Object.keys(opts.list);

  var blockThreshold = 80; // ms
  var i = 0;
  var checkNext = function() {
    var start = typeof performance != 'undefined' ? performance.now() : 0;
    var stop = false;
    var wait = function() { 
      if (opts.wait != null) opts.wait(); // waiting the upper layers as well
      stop = true; 
    };
    while (i < values.length) {
      if (isDone(tracker)) return;

      // If time so far is over threshold and hasn't waited yet, start waiting
      if (!opts.block && !stop) {
        var now = typeof performance != 'undefined' ? performance.now() : 0;
        if (now - start > blockThreshold) {
          start = typeof performance != 'undefined' ? performance.now() : 0;
          wait(); // Don't introduce asynchrony without notifying super methods
          setTimeout(checkNext, 0);
          break;
        }
      }

      func(values[i], function(opts) {
        opts = opts || {};

        if (opts.break) {
          stop = true; // easy way to break a loop
          return done();
        }
        if (!stop) return; // Only works when waited first

        if (!opts.sync && !opts.block) { // Default to async to prevent stack traces overflowing
          setTimeout(checkNext, 0);
        } else checkNext();
      }, keys[i], wait);
      i++;

      if (stop) break;
    }

    if (i == values.length && !stop && !isDone(tracker)) {
      if (finished) debugger; // Shouldn't happen more than once
      done(); // Actually done
      finished = true;
    }
  };
  checkNext();
};
module.exports.for2 = for2;

var after = function(before, after, opts) {
  opts = opts || {};
  var tracker = opts.track;
  before(function() {
    if (isDone(tracker)) return;
    after.apply(null, arguments);
  });
};
module.exports.after = after;

var stream = function(setIn, outCallback, opts) {
  opts = opts || {}; // Can log time lengths for callbacks

  var listeners = {};
  var lastCallbackNum = 0;
  var that = this;
  this.send = function(label, data, opt_callback, opt_idCallback) {
    lastCallbackNum++;
    if (isFunction(data)) {
      // Can skip the data field if no interesting data to send
      opt_callback = data;
      data = {};
    }

    if (opt_idCallback != null) {
      opt_idCallback(lastCallbackNum);
    }
    if (opt_callback != null) {
      listeners[lastCallbackNum] = [{callback: opt_callback, sendTime: performance.now()}];
    }

    if (isFunction(label)) {
      label(data);
    } else {
      outCallback({
        label: label,
        data: data,
        callbackNum: opt_callback != null ? lastCallbackNum : null
      }); 
    }
  };

  this.listen = function(label, callback) {
    listeners[label] = listeners[label] || [];
    listeners[label].push({callback: callback});
  }

  setIn(function(message) {
    if (listeners[message.label] != null) {
      for (var i = 0; i < listeners[message.label].length; i++) {
        var response = listeners[message.label][i].callback(message.data, message.callbackNum);
        if (response != null && message.callbackNum != null) {
          that.send(message.callbackNum, response);
        }
      }
    }
  });
};
module.exports.stream = stream

var escapeHtml = function(unsafeText, opts) {
  if (unsafeText == null) return '';
  opts = opts || {};

  var splitText = [unsafeText];
  var allow = ['\n'];//, '<br>', '<br/>', '<br />', '<strong>', '</strong>', '<b>', '</b>', '<i>', '</i>', '<u>','</u>', '<sub>', '</sub>', '<sup>', '</sup>'];
  splitText = unsafeText.split(new RegExp('('+allow.join('|')+')'));
  
  return splitText.map(function(text, i) {
    if (i % 2 == 1) return text;
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }).join('').split('\n').join('<br>');
};
module.exports.escapeHtml = escapeHtml;

// extends 'from' object with members from 'to'. If 'to' is null, a deep clone of 'from' is returned
var clone = function(from, avoid, to) {
  avoid = avoid || {};
  if (isFunction(from)) return null;
  if (from == null || typeof from != "object") return from;

  if (from.constructor === Array) {
    to = to || from.slice(0);
    for (var i = 0; i < to.length; i++) {
      to[i] = clone(to[i], avoid);
    }
  } else {
    to = to || {};
    for (var name in from) {
      if (name != null && avoid[name] == null) {
        to[name] = typeof to[name] == "undefined" ? clone(from[name], avoid) : to[name];
      }
    }
  }

  return to;
};
module.exports.clone = clone;

var getProp = function(that, prop) {
  return $(that).closest('[data-'+prop+']').attr('data-'+prop);
}
module.exports.getProp = getProp;

var keys = Object.keys;
module.exports.keys = keys;

var numKeys = function(obj) {
  return Object.keys(obj).length;
}
module.exports.numKeys = numKeys;

var getNewId = function(list, prefix) {
  var id = null;
  var outOf = (Object.keys(list).length + 1) * 50;

  while (id == null || list[prefix + id] !== undefined) {
    id = Math.round(Math.random() * outOf);
  }

  return prefix + id;
}
module.exports.getNewId = getNewId;

var writeList = function(list, joinText) {
  if (joinText == null) joinText = 'and';
  if (list.length > 2) return list.slice(0,-1).join(', ') + ', '+joinText+' ' + list.slice(-1)[0]; 
  else if (list.length == 1) return list[0];
  else return list.join(' '+joinText+' ');
};
module.exports.writeList = writeList;

var capFirst = function(text) {
  return (text == null || text.length == 0) ? '' : (text[0].toUpperCase() + text.slice(1));
};
module.exports.capFirst = capFirst;

var getParameterByName = function(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, "\\$&");
  var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}
module.exports.getParameterByName = getParameterByName;