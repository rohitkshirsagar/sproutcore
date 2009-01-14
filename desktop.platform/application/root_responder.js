// ========================================================================
// SproutCore
// copyright 2006-2008 Sprout Systems, Inc.
// ========================================================================

require('application/root_responder');

/**
  Order layer for regular Panels.  Panels appear in front of the main view, 
  but behind palettes, popups.
*/
SC.PANEL_ORDER_LAYER = 0x1000 ;

/** 
  Order layer for Palettes.  Palettes appear in front of the main view and 
  panels, but behind popups.
*/
SC.PALETTE_ORDER_LAYER = 0x2000 ;

/**
  Order layer for Popups.  Popups appear in fron of hte main view and panels.
*/
SC.POPUP_ORDER_LAYER = 0x3000 ;

/*
  This is the root responder subclass for desktop-style applications.  It 
  supports mouse events and window resize events in addition to the built
  in keyboard handling provided by the base class.
*/
SC.RootResponder = SC.RootResponder.extend(
/** @scope SC.RootResponder.prototype */ {

  platform: 'desktop',

  /** @property
    The current front view.  This view should have the highest z-index of all 
    the other views.
  */
  focusedPane: function() {
    var views = this.get('orderedPanes');
    return views[views.length-1];
  }.property('orderedPanes'),
  
  
  /** @property
    Array of panes currently displayed that can be reordered.  This property 
    changes when you orderBack() or orderOut() a pane to determine the next 
    frontmost pane.
  */
  orderedPanes: null,

  /**
    Inserts the passed panes into the orderedPanes array before the named pane 
    array.  Pass null to order at the front.  If this changes the frontmost 
    view, then focus will also be shifted.  The pane you request must have the 
    same orderLayer property at the pane you are passing in.  If it does not, 
    the pane will be placed nearest to the target as possible.
    
    @param {SC.Pane} pane
    @param {SC.Pane} beforePane
    @returns {SC.RootResponder} receiver
  */
  orderBefore: function(pane, beforePane) {
    var currentFocus = this.get('focusedPane');
    var panes = this.get('orderedPanes').without(pane);
    var len, idx, currentOrder, newFocus ;

    // adjust the beforePane to match orderLayer
    var orderLayer = pane.get('orderLayer');
    if (beforePane) {
      len = panes.length;
      idx = panes.indexOf(beforePane);
      currentOrder = beforePane.get('orderLayer');
      
      if (currentOrder<orderLayer) {
        while((beforePane.get('orderLayer')<orderLayer) && (++idx<len)) beforePane = panes[idx];
        if (idx>=len) beforePane = null ; // insert at end if needed 
      } else if (currentOrder>orderLayer) {
        while((beforePane.get('orderLayer')>orderLayer) && (--idx>=0)) beforePane = panes[idx];
        beforePane = (idx<0) ? panes[0] : panes[idx+1]; // go to next pane
      }
    
    // otherwise, find the highest pane matching the order...
    } else {
      idx = panes.length ;
      while((--idx >= 0) && !beforePane) {
        beforePane = panes[idx] ;
        if (beforePane.get('orderLayer') > orderLayer) beforePane = null; // try next one
      }
      if (idx<0) { // did not find a match, insert at beginning
        beforePane = panes[0];
      } else beforePane = panes[idx+1]; // go to next pane
    }
    
    // adjust array
    if (beforePane) {
      idx = panes.indexOf(beforePane);
      panes.insertAt(idx, pane);
    } else panes.push(pane);
    this.set('orderedPanes', panes); // update

    newFocus = this.get('focusedPane'); 
    if (newFocus !== currentFocus) {
      if (currentFocus) currentFocus.blurTo(newFocus);
      if (newFocus) newFocus.focusFrom(currentFocus);
    }
    
    this.panes.add(pane) ; // make sure its in the set...
    return this ;
  },

  /**
    Removes the named pane from the orderedPanes array.  If the pane was also 
    focused, it will also blur the pane and focus the next view.  If the view 
    is key, it will also determine the next view to make key by going down the 
    list of ordered panes, finally ending with the mainPane.
    
    @param {SC.Pane} pane
    @param {SC.Pane} beforePane
    @returns {SC.RootResponder} receiver
  */
  orderOut: function(pane) {
    var currentFocus = this.get('focusedPane'), currentKey = this.get('keyPane');
    
    var panes = this.get('orderedPanes').without(pane) ;
    this.set('orderedPanes', panes) ;
    
    // focus only changes if we are removing the current focus view.
    // in this case, blur the old view and focus the new.  Also, if the view was
    // key, try to make the new focus view key or make main key.
    if (currentFocus === pane) {
      var newFocus = this.get('focusedPane') ;
      if (currentFocus) currentFocus.blurTo(newFocus) ;
      if (newFocus) newFocus.focusFrom(currentFocus) ;
      if (currentKey === pane) this.makeKeyPane(newFocus); 
      
    // if the front is not changing, just check for key view.  Go back to main...
    } else if (currentKey === pane) {
      this.makeKeyPane(null);
    }
    
    this.panes.remove(pane) ; // remove pane from set of panes...
    return this ;
  },
  
  init: function() {
    sc_super();
    this.orderedPanes = []; // create new array  
  },
  
  // .......................................................
  // EVENT HANDLING
  //
  
  setup: function() {
    sc_super();

    // handle basic events        
    this.listenFor('mousedown mouseup click dblclick mouseout mouseover mousemove'.w(), document)
      .listenFor('resize focus blur'.w(), window);
    
    // handle these two events specially in IE
    'drag selectstart'.w().forEach(function(keyName) {
      var method = this[keyName] ;
      if (method) {
        if (SC.browser.msie) {
          var responder = this ;
          document.body['on' + keyName] = function(e) { 
            // return method.call(responder, SC.Event.normalizeEvent(e)); 
            return method.call(responder, SC.Event.normalizeEvent(event || window.event)); // this is IE :(
          };

          // be sure to cleanup memory leaks
           SC.Event.add(window, 'unload', this, function() { 
            document.body['on' + keyName] = null; 
          });
          
        } else {
          SC.Event.add(document, keyName, this, method);
        }
      }
    }, this);
    
    // handle mousewheel specifically for FireFox
    var mousewheel = SC.browser.mozilla ? 'DOMMouseScroll' : 'mousewheel';
    SC.Event.add(document, mousewheel, this, this.mousewheel);
    
    // do some initial set
    this.set('currentWindowSize', this.computeWindowSize()) ;
    this.focus(); // assume the window is focused when you load.
  },

  /**
    Invoked on a keyDown event that is not handled by any actual value.  This 
    will get the key equivalent string and then walk down the keyPane, then 
    the focusedPane, then the mainPane, looking for someone to handle it.  
    Note that this will walk DOWN the view hierarchy, not up it like most.
    
    @returns {Object} Object that handled evet or null
  */ 
  attemptKeyEquivalent: function(evt) {
    var ret = null ;
    
    // keystring is a method name representing the keys pressed (i.e 
    // 'alt_shift_escape')
    var keystring = evt.commandCodes()[0];
    
    // couldn't build a keystring for this key event, nothing to do
    if (!keystring) return NO;
    
    var keyPane  = this.get('keyPane'), mainPane = this.get('mainPane'), 
        mainMenu = this.get('mainMenu');

    // try the keyPane
    if (keyPane) ret = keyPane.performKeyEquivalent(keystring, evt) ;
    
    // if not, then try the main pane
    if (!ret && mainPane && (mainPane!==keyPane)) {
      ret = mainPane.performKeyEquivalent(keystring, evt);
    }

    // if not, then try the main menu
    if (!ret && mainMenu) {
      ret = mainMenu.performKeyEquivalent(keystring, evt);
    }
    
    return ret ;
  },

  /** @property The last known window size. */
  currentWindowSize: null,
  
  /** Computes the window size from the DOM. */  
  computeWindowSize: function() {
    var size ;
    if (window.innerHeight) {
      size = { 
        width: window.innerWidth, 
        height: window.innerHeight 
      } ;

    } else if (document.documentElement && document.documentElement.clientHeight) {
      size = { 
        width: document.documentElement.clientWidth, 
        height: document.documentElement.clientHeight 
      } ;

    } else if (document.body) {
      size = { 
        width: document.body.clientWidth, 
        height: document.body.clientHeight 
      } ;
    }
    return size;
  },
  
  /** 
    On window resize, notifies panes of the change. 
    
    @returns {Boolean}
  */
  resize: function() {
    this._resize();
    //this.invokeLater(this._resize, 10);
    return YES; //always allow normal processing to continue.
  },
  
  _resize: function() {
    // calculate new window size...
    var newSize = this.computeWindowSize(), oldSize = this.get('currentWindowSize');
    this.set('currentWindowSize', newSize); // update size

    if (!SC.rectsEqual(newSize, oldSize)) {
      // notify panes
      SC.runLoop.beginRunLoop();
      this.panes.invoke('windowSizeDidChange', oldSize, newSize) ;
      SC.runLoop.endRunLoop();
    }    
  },
  
  /** 
    Indicates whether or not the window currently has focus.  If you need
    to do something based on whether or not the window is in focus, you can
    setup a binding or observer to this property.  Note that the SproutCore
    automatically adds an sc-focus or sc-blur CSS class to the body tag as
    appropriate.  If you only care about changing the appearance of your 
    controls, you should use those classes in your CSS rules instead.
  */
  hasFocus: NO,

  /**
    Handle window focus.  Change hasFocus and add sc-focus CSS class 
    (removing sc-blur).  Also notify panes.
  */  
  focus: function() {
    if (!this.get('hasFocus')) {
      SC.$('body').addClass('sc-focus').removeClass('sc-blur');

      SC.runLoop.beginRunLoop();
      this.set('hasFocus', YES);
      SC.runLoop.endRunLoop();
    }
    return YES ; // allow default
  },

  /**
    Handle window focus.  Change hasFocus and add sc-focus CSS class (removing 
    sc-blur).  Also notify panes.
  */  
  blur: function() {
    if (this.get('hasFocus')) {
      SC.$('body').addClass('sc-blur').removeClass('sc-focus');

      SC.runLoop.beginRunLoop();
      this.set('hasFocus', NO);
      SC.runLoop.endRunLoop();
    }
    return YES ; // allow default
  },
  
  dragDidStart: function(drag) {
    // console.log('dragDidStart called in %@ with %@'.fmt(this, drag));
    // this._mouseDownView = drag ;
    this._drag = drag ;
  },
  
  mousedown: function(evt) {

    // make sure the window gets focus no matter what.  FF is inconsistant 
    // about this.
    this.focus();

    // first, save the click count.  Click count resets if your down is
    // more than 125msec after you last click up.
    this._clickCount = this._clickCount + 1 ;
    if (!this._lastMouseUpAt || ((Date.now() - this._lastMouseUpAt) > 200)) {
      this._clickCount = 1 ; 
    }
    evt.clickCount = this._clickCount ;

    var view = this.targetViewForEvent(evt) ;
    view = this._mouseDownView = this.sendEvent('mouseDown', evt, view) ;
    if (view && view.respondsTo('mouseDragged')) this._mouseCanDrag = YES ;
    // console.log('mousedown ended in %@'.fmt(this));
    return view ? evt.hasCustomEventHandling : YES;
  },
  
  /**
    mouseUp only gets delivered to the view that handled the mouseDown evt.
    we also handle click and double click notifications through here to 
    ensure consistant delivery.  Note that if mouseDownView is not
    implemented, then no mouseUp event will be sent, but a click will be 
    sent.
  */
  mouseup: function(evt) {
    // console.log('mouseup called in %@ with this._mouseDownView = %@'.fmt(this, this._mouseDownView));
    
    if (this._drag) {
      this._drag.tryToPerform('mouseUp', evt) ;
      this._drag = null ;
    }
    
    var handler = null, view = this._mouseDownView ;
    this._lastMouseUpAt = Date.now() ;

    // record click count.
    evt.clickCount = this._clickCount ;
    
    // attempt the mouseup call only if there's a target.
    // don't want a mouseup going to anyone unless they handled the mousedown...
    if (view) {
      handler = this.sendEvent('mouseUp', evt, view) ;
      
      // try doubleClick
      if (!handler && (this._clickCount === 2)) {
        handler = this.sendEvent('doubleClick', evt, view) ;
      }
      
      // try singleClick
      if (!handler) {
        handler = this.sendEvent('click', evt, view) ;
      }
    }
    
    // try whoever's under the mouse if we haven't handle the mouse up yet
    if (!handler) {
      view = this.targetViewForEvent(evt) ;
      
      // try doubleClick
      if (this._clickCount === 2) {
        handler = this.sendEvent('doubleClick', evt, view);
      }
      
      // try singleClick
      if (!handler) {
        handler = this.sendEvent('click', evt, view) ;
      }
    }
    
    // cleanup
    this._mouseCanDrag = NO; this._mouseDownView = null ;
    
    return (handler) ? evt.hasCustomEventHandling : YES ;
  },

  dblclick: function(evt){
    if(SC.browser.isIE) {
      this._clickCount = 2;
      // this._onmouseup(evt);
      this.mouseup(evt);
    }
  },
  
  
  
  mousewheel: function(evt) {
    var view = this.targetViewForEvent(evt) ;
    var handler = this.sendEvent('mouseWheel', evt, view) ;
    return (handler) ? evt.hasCustomEventHandling : YES ;
  },
  
  _lastHovered: null,
  
  /**
   This will send mouseOver, mouseOut, and mouseMoved to the views you
   hover over.  To receive these events, you must implement the method.
   If any subviews implement them and return true, then you won't receive
   any notices.
   
   If there is a target mouseDown view, then mouse moved events will also
   trigger calls to mouseDragged.
  */
  mousemove: function(evt) {
    SC.runLoop.beginRunLoop();

    // make sure the view gets focus no matter what.  FF is inconsistant 
    // about this.
    this.focus();
    
    // only do mouse[Moved|Entered|Exited|Dragged] if not in a drag session
    // drags send their own events, e.g. drag[Moved|Entered|Exited]
    if (this._drag) {
      this._drag.tryToPerform('mouseDragged', evt);
    } else {
      var lh = this._lastHovered || [] ;
      var nh = [] ;
      var view = this.targetViewForEvent(evt) ;
    
      // work up the view chain.  Notify of mouse entered and
      // mouseMoved if implemented.
      while(view && (view !== this)) {
        if (lh.include(view)) {
          view.tryToPerform('mouseMoved', evt);
          nh.push(view) ;
        } else {
          view.tryToPerform('mouseEntered', evt);
          nh.push(view) ;
        }
      
        view = view.get('nextResponder');
      }

      // now find those views last hovered over that were no longer found 
      // in this chain and notify of mouseExited.
      for(var loc=0; loc < lh.length; loc++) {
        view = lh[loc] ;
        var exited = view.respondsTo('mouseExited') ;
        if (exited && !nh.include(view)) view.tryToPerform('mouseExited',evt);
      }
    
      this._lastHovered = nh; 
    
      // also, if a mouseDownView exists, call the mouseDragged action, if it 
      // exists.
      if (this._mouseDownView) {
        // console.log('mousemove called in %@, this._mouseDownView is %@'.fmt(this, this._mouseDownView));
        this._mouseDownView.tryToPerform('mouseDragged', evt);
      }
    }
    
    SC.runLoop.endRunLoop();
  },

  // these methods are used to prevent unnecessary text-selection in IE,
  // there could be some more work to improve this behavior and make it
  // a bit more useful; right now it's just to prevent bugs when dragging
  // and dropping.
  
  _mouseCanDrag: YES,
  
  selectstart: function() {
    if(this._mouseCanDrag) {
      return false;
    } else {
      return true;
    }
  },
  
  drag: function() { return false; },
  
  // FIXME: in FF, we need to cover any iframes with a view so that we can receive mousemoved events over them...
  startCapturingMouseEvents: function(view) {
    this._captureView = view;
  },
  
  stopCapturingMouseEvents: function() { this._captureView = null; }
    
}) ;
