//API1.0: inline/external scripts extension
woas.script = {
	
	_instances: [],			// array with names of script blocks
	_objects: [],			// array with DOM object references
	_external: [],			// array with boolean values which tell if script is external or not
	_data: [],				// array with data necessary to re-create scripts
	// protect custom scripts and Plugins from running when we are saving WoaS
	_save_reload: false,
	_protect_js_code : function(code) {
		return "if (!woas.script._save_reload) {\n" + code + "\n}\n";
	},
	
	remove: function(script_class, script_id) {
		var id = this._instances.indexOf(script_class+script_id);
		if (id === -1)
			return false;
		// delete DOM entry
		woas._dom_cage.head.removeChild(this._objects[id]);
		// fix arrays
		this._instances.splice(id, 1);
		this._objects.splice(id, 1);
		this._external.splice(id, 1);
		return true;
	},
	
	// regex used to remove some comments
	reJSComments: /^\s*\/\*[\s\S]*?\*\/\s*/g,
	
	_internal_add: function(script_token, script_content, external) {
		var s_elem = document.createElement("script");
		s_elem.type="text/javascript";
		s_elem.id = "woas_"+script_token;
		if (external)
			s_elem.src = script_content;
		woas._dom_cage.head.appendChild(s_elem);
		if (!external)
			// add the inline code with a protection from re-run which could happen upon saving WoaS
			woas.setHTML(s_elem, this._protect_js_code(script_content));
		// register in our management arrays
		this._objects.push(s_elem);
	},
	
	add: function(script_class, script_id, script_content, external) {
		// remove the comments
		script_content = script_content.replace(this.reJSComments, '');
		if (!script_content.length) return false;
		
		var script_token = script_class+"_"+script_id;
		this._internal_add(script_token, script_content, external);
		
		// add to complementary arrays too
		this._instances.push(script_token);
		this._external.push(external ? true : false );
		return true;
	},
	
	// remove all script objects
	// if saving is true, then store data for later re-creation
	// otherwise discard everything
	remove_all: function(saving) {
		var it=_instances.length;
		for(var i=0;i<it;++i) {
			// progressively save data as a memory representation
			if (saving) {
				if (this._external[i])
					this._data.push(this._objects[i].src);
				else
					this._data.push(woas.getHTML(this._objects[i]));
			}
			// remove the object
			woas._dom_cage.head.removeChild(this._objects[i]);
		}
		// clear objects array
		this._objects = [];
	},
	
	// restore all scripts objects
	// if saving is true, then apply code protection to prevent re-execution
	restore_all: function(saving) {
		var it=_instances.length;
		for(var i=0;i<it;++i) {
			this._internal_add(_instances[i], _data[i], _external[i]);
		}
		// clear data after restore
		this._data = [];
	}
	
};

// namespace for custom stuff defined by macros/plugins
// if you are a JavaScript developer you should put singleton instance objects in here
woas.custom = { };
