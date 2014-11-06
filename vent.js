(function(global) {
  // The event is in the capturing phase.
  var CAPTURING_PHASE = 1;

  // The event is being evaluated at the target element.
  var AT_TARGET = 2;

  // The event is in the bubbling phase.
  var BUBBLING_PHASE = 3;

  /**
    Check if there is a common element in two arrays

    @ignore
  */
  function intersects(left, right) {
    for (var i = 0; i < left.length; i++) {
      if (right.indexOf(left[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  /**
    Get the right method to match selectors on

    @ignore
  */
  var matchesSelector = (function() {
    var proto = Element.prototype;
    var matchesSelector = (
      proto.matches ||
      proto.matchesSelector ||
      proto.webkitMatchesSelector ||
      proto.mozMatchesSelector ||
      proto.msMatchesSelector ||
      proto.oMatchesSelector
    );

    if (!matchesSelector) {
      throw new Error('Vent: Browser does not support matchesSelector');
    }

    return matchesSelector;
  }());

  /**
    @class Vent
    @classdesc Event delegation that works.
  */
  var Vent = function(elOrSelector) {
    if (this === global) {
      throw new Error('Vent must be invoked with the new keyword');
    }

    var el;
    if (typeof elOrSelector === 'string') {
      el = document.querySelector(elOrSelector);
    }
    else {
      el = elOrSelector;
    }

    // Store element
    this.el = el;

    // Map of event names to array of events
    this._eventsByType = {};

    // All events
    this._allEvents = [];

    var self = this;
    /**
      Execute all listeners that should happen in the capture phase

      @private
      @memberof Vent
    */
    this._executeCapturePhaseListeners = function(event) {
      // Tell _executeListeners to deal with capture phase events only
      self._executeListeners(event, true);
    };

    /**
      Execute all listeners that should happen in the bubble phase

      @private
      @memberof Vent
    */
    this._executeBubblePhaseListeners = function(event) {
      // Tell _executeListeners to deal with bubble phase events only
      self._executeListeners(event, false);
    };
  }

  /**
    Handles all events added with Vent

    @private
    @memberof Vent
  */
  Vent.prototype._executeListeners = function(event, captureOnly) {
    var listeners = this._eventsByType[event.type];

    if (!listeners) {
      throw new Error('Vent: _executeListeners called in response to event we are not listening to');
    }

    // Get a copy of the listeners
    // Without this, removing an event inside of a callback will cause errors
    listeners = listeners.slice();

    var target = event.target;
    // If the event was triggered on a text node, delegation should assume the target is its parent
    if (target.nodeType === Node.TEXT_NODE) {
      target = target.parentNode;
    }

    if (listeners) {
      // Check for events matching the event name
      var listener;
      for (var i = 0; i < listeners.length; i++) {
        listener = listeners[i];

        if (
          // Check if the target elements matches the selector
          (
            // Always trigger if no selector provided
            listener.selector === null ||
            (
              // Only trigger if the event isn't triggered directly on the element
              target !== this.el &&
              // And if the selector matches
              matchesSelector.call(target, listener.selector)
            )
          )
          // Check if the event is the in right phase
          && (listener.useCapture === captureOnly)
        ) {
          // Call handlers in the right scope, passing the event
          listener.handler.call(event.target, event);
        }
      }
    }
  };

  /**
    Add an event listener.
    @memberof Vent

    @param {String} eventName
      The event name to listen for, including optional namespace(s).
    @param {String} [selector]
      The selector to use for event delegation.
    @param {Function} handler
      The function that will be called when the event is triggered.
    @param {Boolean} [useCapture]
      Whether or not to listen during the capturing or bubbling phase.

    @returns {Vent} this, chainable.
  */
  Vent.prototype.on = function(eventName, selector, handler, useCapture) {
    if (typeof selector === 'function') {
      useCapture = handler;
      handler = selector;
      selector = null;
    }

    if (typeof handler !== 'function') {
      throw new Error('Vent: Cannot add listener with non-function handler');
    }

    // Be null if every falsy (undefined or empty string passed)
    if (!selector) {
      selector = null;
    }

    // false by default
    // This matches the HTML API
    if (typeof useCapture === 'undefined') {
      useCapture = false;
    }

    // Extract namespaces
    var namespaces = null;
    var dotIndex = eventName.indexOf('.');
    if (dotIndex !== -1) {
      namespaces = eventName.slice(dotIndex+1).split('.');
      eventName = eventName.slice(0, dotIndex);
    }

    if (!this._eventsByType[eventName]) {
      // Create the list for the event type
      this._eventsByType[eventName] = [];

      // Add master listeners
      this.el.addEventListener(eventName, this._executeCapturePhaseListeners, true);
      this.el.addEventListener(eventName, this._executeBubblePhaseListeners, false);
    }

    // Create an object with the events information
    var eventObject = {
      eventName: eventName,
      handler: handler,
      namespaces: namespaces,
      selector: selector,
      useCapture: useCapture
    };

    // Store relative to the current type and with everyone else
    this._eventsByType[eventName].push(eventObject);
    this._allEvents.push(eventObject);
  };

  /**
    Remove an event listener.
    @memberof Vent

    @param {String} [eventName]
      The event name to stop listening for, including optional namespace(s).
    @param {String} [selector]
      The selector that was used for event delegation.
    @param {Function} [handler]
      The function that was passed to <code>on()</code>.
    @param {Boolean} [useCapture]
      Only remove listeners with <code>useCapture</code> set to the value passed in.

    @returns {Vent} this, chainable.
  */
  Vent.prototype.off = function(eventName, selector, handler, useCapture) {
    if (typeof selector === 'function') {
      useCapture = handler;
      handler = selector;
      selector = null;
    }

    // Be null if not provided
    if (typeof eventName === 'undefined') {
      eventName = null;
    }

    if (typeof selector === 'undefined') {
      selector = null;
    }

    if (typeof handler === 'undefined') {
      handler = null;
    }

    if (typeof useCapture === 'undefined') {
      useCapture = null;
    }

    // Extract namespaces
    var namespaces = null;
    if (eventName) {
      var dotIndex = eventName.indexOf('.');
      if (dotIndex !== -1) {
        namespaces = eventName.slice(dotIndex+1).split('.');
        eventName = eventName.slice(0, dotIndex);
      }
    }

    // Be null
    if (eventName === '') {
      eventName = null;
    }

    var event;
    var index;
    var events = this._allEvents;
    for (var i = 0; i < this._allEvents.length; i++) {
      event = this._allEvents[i];

      if (
        (eventName === null || event.eventName === eventName) &&
        (selector === null || event.selector === selector) &&
        (handler === null || event.handler === handler) &&
        (useCapture === null || event.useCapture === useCapture) &&
        (
          // Remove matching events, regardless of namespace
          namespaces === null ||
          // Listener specifies a matching namespace
          (event.namespaces && intersects(namespaces, event.namespaces))
        )
      ) {
        // Remove the event info
        this._allEvents.splice(i, 1);

        // Array length changed, so check the same index on the next iteration
        i--;

        // Don't stop now! We want to remove all matching events

        // Get index in eventsByType map
        if (!this._eventsByType[event.eventName]) {
          throw new Error('Vent: Missing eventsByType for '+event.eventName);
        }

        index = this._eventsByType[event.eventName].indexOf(event);

        if (index !== -1) {
          var mapList = this._eventsByType[event.eventName];

          // Remove from the map
          mapList.splice(index, 1);

          // Remove actual listener if none are left
          if (mapList.length === 0) {
            // Remove the listener
            this.el.removeEventListener(event.eventName, this._executeCapturePhaseListeners, true);
            this.el.removeEventListener(event.eventName, this._executeBubblePhaseListeners, false);

            // Avoid using delete operator for performance
            this._eventsByType[event.eventName] = null;
          }
        }
        else {
          throw new Error('Vent: Event existed in allEvents, but did not exist in eventsByType');
        }
      }
    }

    return this;
  };

  if (typeof CustomEvent === 'function') {
    // Use native CustomEvent on platforms that support it
    // Note: defaultPrevented will not be set correctly if CustomEvent is polyfilled

    /**
      Trigger an event
      @memberof Vent

      @param {String} eventName
        The name of the event to trigger.
      @param {Object} [options]
        CustomEvent options.
      @param {Object} [options.bubbles=true]
        Whether the event should bubble.
      @param {Object} [options.cancelable=true]
        Whether the event should be cancelable.
      @param {Object} [options.detail]
        Data to pass to handlers as <code>event.detail</code>
    */
    Vent.prototype.trigger = function(eventName, options) {
      options = options || {};

      if (typeof options.bubbles === 'undefined') {
        options.bubbles = true;
      }

      if (typeof options.cancelable === 'undefined') {
        options.cancelable = true;
      }

      var event = new CustomEvent(eventName, options);
      this.el.dispatchEvent(event);

      return event;
    };
  }
  else {
    // Use createEvent for old browsers
    Vent.prototype.trigger = function(eventName, options) {
      options = options || {};

      if (typeof options.bubbles === 'undefined') {
        options.bubbles = true;
      }

      if (typeof options.cancelable === 'undefined') {
        options.cancelable = true;
      }

      var event = document.createEvent('CustomEvent');
      event.initCustomEvent(eventName, options.bubbles, options.cancelable, options.detail);

      var defaultPrevented = !this.el.dispatchEvent(event);

      if (defaultPrevented !== event.defaultPrevented) {
        // dispatchEvent() doesn't correctly set defaultPrevented in IE 9
        // However, it does return the correct value when dispatchEvent() called
        // Furthermore, the returned event's defaultPrevented property is readonly
        // To work around this, we create a new event object with the correct defaultPrevented
        // Note: The patched event object will not have the correct prototype and will not be an instance of an event
        var patchedEvent = {};
        for (var prop in event) {
          patchedEvent[prop] = event[prop];
        }

        // Store the correct value for defaultPrevented
        patchedEvent.defaultPrevented = defaultPrevented;

        // Store the original event
        patchedEvent.originalEvent = event;

        return patchedEvent;
      }

      return event;
    };
  }

  /**
    Destroy this instance, removing all events and references.
  */
  Vent.prototype.destroy = function() {
    // Remove all events
    this.off();

    // Remove all references
    this._eventsByType = null;
    this._allEvents = null;
    this.el = null;
  };

  // Expose globally
  global.Vent = Vent;
}(this));
