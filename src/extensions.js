
var _bootscript = null;					// bootscript

// the hotkeys runtime object
woas.hotkeys = {
	"save":		"s",
	"edit":		"e",
	"print":	"p",
	"help":		"h",
	"goto":		"g",
	"cancel":	0x1b,
	"back":		0x8
};
woas.cached_default_hotkeys = null;
woas.custom_accesskeys = [];

// custom scripts array (those defined by current page)
woas._custom_scripts = [];

// plugin scripts array (those defined by active plugins)
woas._plugin_scripts = [];


woas._clear_custom_scripts = function () {
	if (!this._custom_scripts.length) return;
	for(var i=0,it=this._custom_scripts.length;i<it;i++) {
		// remove the DOM object
		this._dom_cage.head.removeChild(this._custom_scripts[i]);
	}
	// clear the array
	this._custom_scripts = [];
};

woas.create_breadcrumb = function(title) {
//	log("Creating breadcrumb for title \""+title+"\"");	//log:0
	var tmp=title.split("::");
	if (tmp.length==1)
		return title;
	var s="", partial="", js="";
	for(var i=0;i<tmp.length-1;i++) {
		// editing is active
		if (kbd_hooking)
			s+= tmp[i]+" :: ";
		else {
			partial += tmp[i]+"::";
			js = "go_to('"+this.js_encode(partial)+"')";
			s += "<a href=\"javascript:"+js+"\" onclick=\""+js+"; return false;\">"+tmp[i]+"</a> :: ";		
		}
	}
	// add page title
	return s+tmp[tmp.length-1];
};

// protect custom scripts, Bootscript and Plugins from running when we are saving WoaS
woas._save_reload = false;
woas._protect_js_code = function(code) {
	return "if (!woas._save_reload) {\n" + code + "\n}\n";
};

var reJSComments = /^\s*\/\*[\s\S]*?\*\/\s*/g;
woas._mk_active_script = function(code, id, i, external) {
	// remove the comments
	code = code.replace(reJSComments, '');
	if (!code.length) return null;
	var s_elem = document.createElement("script");
	s_elem.type="text/javascript";
	s_elem.id = "woas_"+id+"_script_"+i;
	if (external)
		s_elem.src = code;
	this._dom_cage.head.appendChild(s_elem);
	if (!external)
		// add the inline code with a protection from re-run which could happen upon saving WoaS
		woas.setHTML(s_elem, this._protect_js_code(code));
	return s_elem;
};

woas._create_bs = function(saving) {
	// do not run bootscript in safe mode
	if (this.config.safe_mode)
		return false;
	var code=this.get_text("WoaS::Bootscript");
	if (code===null || !code.length) return false;
	if (saving)
		woas._save_reload = true;
	_bootscript = this._mk_active_script(this._protect_js_code(code), "plugin", 0, false);
	if (saving)
		woas._save_reload = false;
	return true;
};

// remove bootscript (when erasing for example)
woas._clear_bs = function() {
	if (_bootscript !== null) {
		this._dom_cage.head.removeChild(_bootscript);
		_bootscript = null;
	}
};

woas._activate_scripts = function(saving) {
	// add the custom scripts (if any)
	if (this.parser.script_extension.length) {
		if (saving)
			this._save_reload = true;
//		log(this.parser.script_extension.length + " javascript files/blocks to process");	// log:0
		var s_elem, external;
		for (var i=0;i<this.parser.script_extension.length;i++) {
			external = new String(typeof(this.parser.script_extension[i]));
			external = (external.toLowerCase()!=="string");
			s_elem = this._mk_active_script(
					external ? this.parser.script_extension[i][0] : this.parser.script_extension[i],
					"custom", i, external);
			// sometimes instancing the script is not necessary
			if (s_elem !== null)
				this._custom_scripts.push(s_elem);
		}
		if (saving)
			this._save_reload = false;
	}
};

woas._new_plugins = function(new_plugins, saving) {
	//TODO: create a script object for each new plugin
};

woas.validate_hotkey = function(k) {
	// validate hexadecimal hotkey
	if (k.substr(0, 2) == "0x") {
		k = parseInt(k.substr(2), 16);
		if (!k)
			return null;
		return k;
	}
	// validate single ASCII character
	if (k.length>1)
		return null;
	return k;
}

var reHotkeys = /^\$([A-Za-z0-9_]{2,})(\([A-Za-z0-9_]+\))?\s+([\S]+)\s*$/gm;
woas._load_hotkeys = function(s) {
	var new_custom_accesskeys=[];
	// identify valid alias lines and get the key binding/hotkey
	s.replace(reHotkeys, function(str, hkey, lambda, binding) {
		// check that binding is a valid key
		binding = woas.validate_hotkey(binding);
		if (binding === null) {
			log("Skipping invalid key binding for hotkey "+hkey);	//log:1
			return;
		}
		// associate a custom key binding
		if (hkey == "CUSTOM") {
			// store the custom definition for later update
			lambda = lambda.substr(1, lambda.length-2);
			new_custom_accesskeys.push({"fn":lambda, "key":binding});
		} else {
			// convert hotkey to lowercase
			hkey = hkey.toLowerCase();
			// check that hotkey exists
			if (typeof woas.hotkeys[hkey] == "undefined") {
				log("Skipping unknown hotkey "+hkey);	//log:1
				return;
			}
			// associate hotkey and key binding
			woas.hotkeys[hkey] = binding;
		}
	});
	// once finished loading hotkey definitions, associate them
	$("woas_save_hl").accessKey = this.hotkeys.save;
	$("woas_edit_hl").accessKey = this.hotkeys.edit;
	$("woas_print_hl").accessKey = this.hotkeys.print;
	$("woas_help_hl").accessKey = this.hotkeys.help;
	//TODO: set access key for goto feature
	// (1) delete access keys which no more exist
	var found,a,b;
	for(a=0,at=this.custom_accesskeys.length;a<at;++a) {
		found = false;
		for (b=0,bt=new_custom_accesskeys.length;b<bt;++b) {
			if (this.custom_accesskeys[a].key === new_custom_accesskeys[b].key) {
				found = true;
				// access key element was found, update the associated function (if necessary)
				if (this.custom_accesskeys[a].fn !== new_custom_accesskeys[b].fn) {
					this.custom_accesskeys[a].obj.onclick = new_custom_accesskeys[b].fn+"(); return false;";
				}
				break;
			}
		}
		// proceed to removal
		if (!found) {
			$("woas_custom_accesskeys").removeChild(this.custom_accesskeys[a].obj);
			delete this.custom_accesskeys[a].obj;
			this.custom_accesskeys.splice(a,1);
			--at;
		}
	}
	// (2) add new access keys
	this._update_accesskeys(new_custom_accesskeys);
}

woas._update_accesskeys = function(new_custom_accesskeys) {
	var ak, a, b, at, bt;
	// we store the length of old access keys before looping because
	// other entries might be added during the cycles
	bt=this.custom_accesskeys.length;
	for(a=0,at=new_custom_accesskeys.length;a<at;++a) {
		found = false;
		for (b=0;b<bt;++b) {
			// access key already exists
			if (this.custom_accesskeys[b].key === new_custom_accesskeys[a].key) {
				found = true;
				break;
			}
		}
		// proceed to addition
		if (!found) {
			ak = document.createElement("a");
//			ak.setAttribute("onclick", new_custom_accesskeys[a].fn+"(); return false;");
			ak.href="javascript:"+new_custom_accesskeys[a].fn+"()";
			ak.accessKey = new_custom_accesskeys[a].key;
			// store the new access key
			this.custom_accesskeys.push({"fn":new_custom_accesskeys[a].fn,"key":new_custom_accesskeys[a].key,
										 "obj":ak});
			$("woas_custom_accesskeys").appendChild(ak);
		}
	}
	// (3) clear the div content if no custom access key is there (just for safety)
	if (this.custom_accesskeys.length == 0)
		this.setHTML($("woas_custom_accesskeys"), "&nbsp;");
}

// return the default hotkeys/key bindings
woas._default_hotkeys = function() {
	if (this.cached_default_hotkeys === null) {
		this.cached_default_hotkeys="";
		var k;
		for(var hkey in this.hotkeys) {
			k = this.hotkeys[hkey];
			switch(typeof k) {
				case "string":
				break;
				default: // Number
					k = "0x"+k.toString(16);
			}
			this.cached_default_hotkeys += "$"+hkey.toUpperCase()+"\t"+k+"\n";
		}
	}
	return this.cached_default_hotkeys;
};

// call once during code setup to store the current default hotkeys
woas._default_hotkeys();

woas._plugins_list = function() {
	return "\n\n/No plugins installed/";
};
