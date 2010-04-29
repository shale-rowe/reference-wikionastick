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

// count of custom scripts defined inline as script tags
woas._custom_scripts = 0;

// plugin scripts array (those defined by active plugins)
woas._plugin_scripts = [];

// clear all custom scripts
woas._clear_custom_scripts = function () {
	if (!this._custom_scripts.length) return;
	for(var i=0;i<this._custom_scripts;i++) {
		this.dom.remove_script("custom", i);
	}
	// clear the counter
	this._custom_scripts = 0;
};

// generate parsed scripts
woas._activate_scripts = function() {
	// add the custom scripts (if any)
	if (this.parser.script_extension.length) {
//		log(this.parser.script_extension.length + " javascript files/blocks to process");	// log:0
		var external;
		for (var i=0;i<this.parser.script_extension.length;i++) {
			external = new String(typeof(this.parser.script_extension[i]));
			external = (external.toLowerCase()!=="string");
			// sometimes instancing the script is not necessary
			// the add method will check it out for us and return false when no script was instanced
			if (this.dom.add_script("custom", i,
						external ? this.parser.script_extension[i][0] : this.parser.script_extension[i],
						external))
				// increment counter of scripts
				this._custom_scripts++;
		}
	}
};

// disable one single plugin
woas._disable_plugin = function(name) {
	for(var i=0,it=this._plugin_scripts.length;i<it;++i) {
		if (this._plugin_scripts[i] !== name)
			continue;
		// attempt removing the script block and fail otherwise
		if (!this.dom.remove_script("plugin", this._plugin_scripts[i]))
			return false;
		this._plugin_scripts.splice(i, 1);
		return true;
	}
	return false;
};

woas._update_plugin = function(name) {
	return this._disable_plugin(name) && this._enable_plugin(name);
}

// enable a single plugin
woas._enable_plugin = function(name) {
	// generate the script element
	if (this.dom.add_script("plugin", name,
						this.get_text("WoaS::Plugins::"+name),
						false)) {
		this._plugin_scripts.push( name );
		return true;
	}
	return false;
};

// remove DOM object for all plugins
woas._clear_plugins = function() {
	for(var i=0,it=this._plugin_scripts.length;i<it;++i) {
		// remove the DOM object
		this.dom.remove_script("plugin", this._plugin_scripts[i]);
	}
	// reset array
	this._plugin_scripts = [];
};

woas._load_plugins = function() {
	//TODO: get plugins configuration

	// get list of plugins
	var _pfx = "WoaS::Plugins::", l=_pfx.length, name;
	for(var i=0,it=page_titles.length;i<it;++i) {
		if (page_titles[i].substr(0, l) === _pfx) {
			name = page_titles[i].substr(_pfx.length);
			// generate the script element
			if (this.dom.add_script("plugin", name,
							this.get__text(i),
							false))
				// add to global array
				this._plugin_scripts.push( name );
		}
	}
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

// if given page name is a plugin, disable it
// used when deleting pages
woas._plugin_delete_check = function(pname) {
	var _pfx = "WoaS::Plugins::";
	if (pname.substr(0, _pfx.length) === _pfx)
		this._disable_plugin(pname.substr(_pfx.length));
};

woas._delete_plugin = function(name) {
	var page_name = "WoaS::Plugins::"+name;
	if (!confirm(woas.i18n.CONFIRM_DELETE.sprintf(page_name)))
		return;
	if (!this._disable_plugin(name))
		return false;
	this.delete_page(page_name);
	if (current === "WoaS::Plugins") {
		// reload plugins
		$("wiki_text").innerHTML = this.parser.parse(this.get_text("WoaS::Plugins") + this._plugins_list());
	}
};

woas._edit_plugin = function(name) {
	if (go_to("WoaS::Plugins::"+name))
		woas.edit_page(current);
};

woas._plugins_list = function() {
	var pt = this._plugin_scripts.length;
	if (pt === 0)
		return "\n\n/No plugins installed/";
	var pg=[];
	for(var i=0;i<pt;++i){
		pg.push("* [[WoaS::Plugins::"+this._plugin_scripts[i]+"|"+this._plugin_scripts[i]+"]]"+
				"&nbsp;&nbsp;[[Javascript::woas._delete_plugin('"+this._plugin_scripts[i]+"')|Delete]]"+
				"&nbsp;&nbsp;[[Javascript::woas._edit_plugin('"+this._plugin_scripts[i]+"')|Edit...]]"+
				"\n");
	}
	return "\n\n"+this._simple_join_list(pg);
};

var reAliases = /^(\$[A-Za-z0-9_]{2,})\s+(.*?)$/gm;
// match all aliases defined in a page
woas._load_aliases = function(s) {
	this.aliases = [];
	if (s==null || !s.length) return;
	s.replace(reAliases, function(str, alias, value) {
		// save the array with the alias regex and alias value
		var cpok = [ new RegExp(RegExp.escape(alias), "g"), value];
		woas.aliases.push(cpok);
	});
};

woas.aliases = [];

woas.title_unalias = function(aliased_title) {
	// apply aliases on title, from newest to oldest
	for(var i=0,l=this.aliases.length;i<l;++i) {
		aliased_title = aliased_title.replace(this.aliases[i][0], this.aliases[i][1]);
	}
	return aliased_title;
};
