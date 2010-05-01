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

// WoaS 'scripting' module manages custom scripts declared in menu and main page
// All custom scripts can be defined in one of the two
woas.scripting = {
	menu: [],	// scripts active in menu
	page: [],	// scripts active in page
	_menu_stacked: 0,	// number of elements which shall be cleared
	_page_stacked: 0,	// ''
	
	// remove all scripts from specified array (can be 'menu' or 'page')
	clear: function(which) {
		for(var i=0;i<this["_"+which+"_stacked"];++i) {
			woas.dom.remove_script(which, i);
		}
		this["_"+which+"_stacked"] = 0;
	},
	
	// add a custom script for later activation
	add: function(which, content, external) {
		this[which].push([content, external]);
	},
	
	activate: function(which) {
		for(var i=0;i<this[which].length;++i) {
			if (woas.dom.add_script(which, i, this[which][i][0], this[which][i][1]))
				++this["_"+which+"_stacked"];
		}
		// free memory
		this[which] = [];
	},
	
	remove: function(which, index) {
		if (woas.dom.remove_script(which, index)) {
			--this["_"+which+"_stacked"];
			return true;
		}
		return false;
	}
	
};

// 'plugins' WoaS module
woas.plugins = {
	
	// flag set by last call to get()
	is_external: false,
	_active: [],	// list of enabled plugins
	
	get: function(name) {
		this.is_external = false;
		var text = woas.pager.get("WoaS::Plugins::"+name);
		// check if this is an external page reference
		// -- UNSUPPORTED FEATURE --
		if (name.charAt(0) === '@') {
			// hack for external files loading at run-time
			// each source file specified in a new line
			var uris=[], uri;
			text = text.split("\n");
			for(var i=0;i < text.length;++i) {
				uri = woas.trim(text[i]);
				if (uri.length)
					uris.push(uri);
			}
			if (uris.length !== 0) {
				this.is_external = true;
				// we do return an array
				text = uris;
			} else
				woas.log("no valid source URIs found");
		}
		return text;
	},

	// disable one single plugin
	disable: function(name) {
		var i = this._active.indexOf(name);
		if (i !== -1) {
			_mapped_name = this._mapping(name);
			// attempt removing the script block and fail otherwise
			if (!woas.dom.remove("plugin", _mapped_name))
				return false;
			// external plugin, try to remove the lib blocks created
			if (name.charAt(0) === '@') {
				var p = this.get(name);
				if (this.is_external && (p.length>1)) { // *special* external plugins
					for(var i=0;i < p.length;++i) {
						woas.dom.remove_script("lib", _mapped_name+'_'+i);
					}
				}
			}
			this._active.splice(i, 1);
			return true;
		}
		return false;
	},

	update: function(name) {
		return this.disable(name) && this.enable(name);
	},

	// enable a single plugin
	enable: function(name) {
		// generate the script element
		var p = this.get(name);
		if (this.is_external) { // *special* external plugins
			// single reference, do not create script block
			if (p.length === 1) {
				if (woas.dom.add_script("plugin", this._mapping(name), p[0], true)) {
					this._active.push( name );
					return true;
				}
				// failed adding DOM script
				return false;
			} else {
				var js="";
				for(var i=0;i < p.length;++i) {
					js += 'woas.dom.add_script("lib", "'+this._mapping(name)+'_'+i+"\", true);\n";
				}
				if (woas.dom.add_script("plugin", this._mapping(name), js, false)) {
					this._active.push( name );
					return true;
				}
				return false;
			}
		} 
		// normal plugins
		if (woas.dom.add_script("plugin", this._mapping(name),
					p, false)) {
			this._active.push( name );
			return true;
		}
		return false;
	},
	
	// remove DOM object for all plugins
	clear: function() {
		for(var i=0,it=this._active.length;i<it;++i) {
			// remove the DOM object
			this.dom.remove_script("plugin", this._mapping(this._active[i]));
		}
		// reset array
		this._active = [];
	},
	
	// map a plugin name to an unique name
	_mapping_cache:[],
	_mapping: function(name) {
		var i = this._mapping_cache.indexOf(name);
		if (i == -1) {
			i = this._mapping_cache.length;
			this._mapping_cache.push(name);
		}
		return i;
	},
	
	load: function() {
		//TODO: get plugins configuration

		// get list of plugins
		var _pfx = "WoaS::Plugins::", l=_pfx.length, name;
		for(var i=0,it=page_titles.length;i<it;++i) {
			if (page_titles[i].substr(0, l) === _pfx) {
				name = page_titles[i].substr(_pfx.length);
				// generate the script element
				this.enable(name);
			}
		} //efor
	},
	
	list: function() {
		var pt = this._active.length;
		if (pt === 0)
			return "\n\n/No plugins installed/";
		var pg=[];
		for(var i=0;i<pt;++i){
			pg.push("* [[WoaS::Plugins::"+this._active[i]+"|"+this._active[i]+"]]"+
					//TODO: some CSS for the plugin actions
					"&nbsp;&nbsp;[[Javascript::woas._delete_plugin('"+this._active[i]+"')|Delete]]"+
					"&nbsp;&nbsp;[[Javascript::woas._edit_plugin('"+this._active[i]+"')|Edit...]]"+
					"\n");
		}
		return "\n\n"+this._simple_join_list(pg);
	},
	// if given page name is a plugin, disable it
	// used when deleting pages
	delete_check: function(pname) {
		var _pfx = "WoaS::Plugins::";
		if (pname.substr(0, _pfx.length) === _pfx)
			this.disable(pname.substr(_pfx.length));
	},

	remove: function(name) {
		var page_name = "WoaS::Plugins::"+name;
		if (!confirm(woas.i18n.CONFIRM_DELETE.sprintf(page_name)))
			return;
		// first we attempt to disable it
		if (!this.disable(name))
			return false;
		woas.delete_page(page_name);
		if (current === "WoaS::Plugins") {
			// reload plugins
			$("wiki_text").innerHTML = woas.parser.parse(woas.get_text("WoaS::Plugins") + this.list());
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
		if (hkey === "CUSTOM") {
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

woas._edit_plugin = function(name) {
	if (go_to("WoaS::Plugins::"+name))
		woas.edit_page(current);
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
