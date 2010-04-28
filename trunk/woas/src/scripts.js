//API1.0: inline/external scripts extension
woas.script = {
	
	_instances: [],			// array with names of script blocks
	_objects: [],			// array with DOM object references
	
	remove: function(script_class, script_id) {
		var id = this._instances.indexOf(script_class+script_id);
		if (id === -1)
			return false;
		// delete DOM entry
		woas._dom_cage.head.removeChild(this._objects[id]);
		// fix arrays
		this._instances.splice(id, 1);
		this._objects.splice(id, 1);
		return true;
	},
	
	// protect custom scripts and Plugins from running when we are saving WoaS
	_save_reload: false,
	_protect_js_code : function(code) {
		return "if (!woas.script._save_reload) {\n" + code + "\n}\n";
	},
	
	reJSComments: /^\s*\/\*[\s\S]*?\*\/\s*/g,
	
	add: function(script_class, script_id, script_content, external) {
		// remove the comments
		script_content = script_content.replace(this.reJSComments, '');
		if (!script_content.length) return false;
		var s_elem = document.createElement("script");
		s_elem.type="text/javascript";
		s_elem.id = "woas_"+script_class+"_"+script_id;
		if (external)
			s_elem.src = code;
		woas._dom_cage.head.appendChild(s_elem);
		if (!external)
			// add the inline code with a protection from re-run which could happen upon saving WoaS
			woas.setHTML(s_elem, this._protect_js_code(script_content));
		// register in our management arrays
		this._instances.push(script_class+script_id);
		this._objects.push(s_elem);
		return true;
	}
	
};

// namespace for custom stuff defined by macros/plugins
// if you are a JavaScript developer you should put singleton instance objects in here
woas.custom = { };
