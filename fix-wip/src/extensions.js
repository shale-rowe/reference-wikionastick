// @module scripting
// @description manages custom scripts declared in menu and main page
// All custom scripts can be defined in one of the two
woas.scripting = {
	menu: [],	// scripts active in menu
	page: [],	// scripts active in page
	_menu_stacked: 0,	// number of elements which shall be cleared
	_page_stacked: 0,	// ''
	
	// remove all scripts from specified array (can be 'menu' or 'page')
	clear: function(which) {
		for(var i=0;i < this["_"+which+"_stacked"];++i) {
			woas.dom.remove_script(which, i);
		}
		this["_"+which+"_stacked"] = 0;
	},
	
	// add a custom script for later activation
	add: function(which, content, external) {
		this[which].push([content, external]);
	},
	
	activate: function(which) {
		for(var i=0;i < this[which].length;++i) {
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

// @module 'plugins'
woas.plugins = {
	
	// flag set by last call to get()
	is_external: false,
	_all: [],
	_active: [],	// list of enabled plugins
	
	get: function(name) {
		this.is_external = false;
		var text = woas.pager.get("WoaS::Plugins::"+name);
		// check if this is an external page reference
		if (name.charAt(0) === '@') {
			// hack for external files loading at run-time
			// each source file specified in a new line as a definition with flags for different browsers
			var uris = this._parse_external(text);
			if (uris !== null) {
				// we got it
				this.is_external = true;
				text = uris;
			}
		}
		return text;
	},
	
	_parse_external: function(text) {
		var uris=[], uri_def, p, sb;
		text = text.split("\n");
		for(var i=0;i < text.length;++i) {
			uri_def = woas.trim(text[i]);
			if (!uri_def.length)
				continue;
			// check this URI for validity
			p = uri_def.indexOf("=");
			if (p === -1)
				continue;
			sb = this._craft_object(uri_def.substr(p+1));
			if (sb === null) // no mode was activated by this definition
				continue;
			sb.src = woas.trim(uri_def.substr(0,p));
//			woas.log(sb.src+" " +sb.is_inline+" "+sb.is_async);
			// finally add it to basket
			uris.push(sb);
		}
		if (uris.length == 0)
			woas.log("no valid source URIs found");
		return uris;
	},
	
	reIncludeDef: new RegExp("([\\+@])(\\*|([a-zA-Z0-9_]+)(\\([0-9\\.]+[-\\+]?\\))?)", "g"),
	
	// parse definitions for browser include type
	_craft_object: function(s) {
		var sb = {
			is_inline: false,
			is_async: false
		}, inline_init = false, async_init = false;
		s.replace(this.reIncludeDef, function(str, sym, full_browser_str,browser_str, version) {
			// a handy shortcut
			switch (browser_str) {
				case "ff":
					browser_str = "firefox";
				break;
				// not supported
				case "ie6": case "ie8": case "firefox2": case "firefox3": case "firefox_new":
					woas.log("Invalid browser token: "+browser_str);
					return;
			}
			// check the catch-all case
			if (full_browser_str === '*') {
				if (sym === '+') {
					if (!inline_init) {
						inline_init = sb.is_inline = true;
					} else woas.log("Ignored catch-all inline because a restricting criteria was already specified");
				} else { // if (sym === '@')
					if (!async_init) {
						async_init = sb.is_async = true;
					} else woas.log("Ignored catch-all async because a restricting criteria was already specified");
				}
				return;
			}
			// check that this browser token is valid
			var t = typeof woas.browser[browser_str];
			if (t == "undefined") {
				woas.log("Invalid browser token: "+browser_str);
				return;
			}
			// parse the symbol if that browser token is active and version matches
			if (woas.browser[browser_str]) {
				// make a version check only if necessary
				var its_ok = false;
				if (version.length !== 0) {
					// check that we have a version string, before all
					if (t != "string") {
						woas.log("No version string for browser token \""+browser_str+"\"");
						return;
					}
					// remove parenthesis
					version = version.substr(1, version.length-2);
					// check the last character
					var lc = version.charAt(version.length-1);
					if (lc === '+') { // match version and above
						its_ok = (woas.strnatcmp(woas.browser[browser_str], version) >= 0);
					} else if (lc === '-') { // match version and below
						its_ok = (woas.strnatcmp(woas.browser[browser_str], version) <= 0);
					} else { // plain version match
						its_ok = (woas.strnatcmp(woas.browser[browser_str], version) == 0);
					}
				} else its_ok = true;
				// version was not OK
				if (!its_ok) return;
				// operate the operator
				if (sym === '+') {
					sb.is_inline = true;
					sb.is_async = false;
					inline_init = true;
				} else {
					sb.is_async = true;
					sb.is_inline = false;
					async_init = true;
				}
			}
			// continue with next token
		});
		// if nothing was specified, fail
		if (!inline_init && !async_init) return null;
		return sb;
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
	
	_internal_add: function(name, s) {
		if (s.is_async) {
			if (woas.dom.add_script("plugin", this._mapping(name), s.src, true)) {
				this._active.push( name );
				return true;
			}
		} else /*if (s.is_inline) */ { // create an inline javascript (slower)
			var ct = woas.load_file(woas.ROOT_DIRECTORY+woas.fix_path_separators(s.src)),
				t = (typeof ct);
			// write some nice message
			if (t.toLowerCase() != "string") {
				woas.log("could not load inline javascript source "+s.src);
				return false;
			} else {
				// add the inline block
				if (woas.dom.add_script("plugin", this._mapping(name), ct, false)) {
					this._active.push( name );
					return true;
				}
			}
		}
		// failed adding DOM script
		return false;
	},

	// enable a single plugin
	enable: function(name) {
		if (this._active.indexOf(name) !== -1) {
			woas.log("BUG: Plugin "+name+" is already active");
			return true;
		}
		// generate the script element
		var p = this.get(name);
		if (this.is_external) { // *special* external plugins
			// single reference, do not create script block
			if (p.length === 1) {
				return this._internal_add(name, p[0] );
			} else {
				var js="";
				for(var i=0;i < p.length;++i) {
					if (p[i].is_async)
						js += 'woas.dom.add_script("lib", "'+this._mapping(name)+'_'+i+"\", \""+woas.js_encode(p[i].src)+"\", true);\n";
					else /*if (p[i].is_inline) */ {
						var ct = woas.load_file(woas.ROOT_DIRECTORY+woas.fix_path_separators(p[i].src)),
							t = (typeof ct);
						// write some nice message
						if (t.toLowerCase() !== "string")
							js += "/* woas.load_file(\"::/"+p[i].src+"\") returned "+ct+" ("+t+") */\n";
						else {
							// add the loaded code
							js += ct; ct = null;
						}
					} // no other symbols for now
				} //efor
				// finally add the real script block
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
	
	// remove DOM object for all active plugins
	clear: function() {
		for(var i=0,it=this._active.length;i < it;++i) {
			// remove the DOM object
			this.dom.remove_script("plugin", this._mapping(this._active[i]));
		}
		// reset array
		this._active = [];
		this._all = [];
	},
	
	// map a plugin name to an unique name
	_mapping_cache:[],
	_mapping: function(name) {
		var i = this._mapping_cache.indexOf(name);
		if (i == -1) {
			i = this._mapping_cache.length;
			this._mapping_cache.push(name);
		}
		// return more descriptive names
		if (woas.config.debug_mode)
			return woas._unix_normalize(name).replace("@", '')+"_"+i;
		return i;
	},
	
	load: function() {
		//TODO: get plugins configuration

		// get list of plugins
		var _pfx = "WoaS::Plugins::", l=_pfx.length, name;
		for(var i=0,it=page_titles.length;i < it;++i) {
			if (page_titles[i].substr(0, l) === _pfx) {
				name = page_titles[i].substr(_pfx.length);
				// generate the script element
				this.enable(name);
				this._all.push(name);
			}
		} //efor
	},
	
	list: function() {
		var pt = this._all.length;
		if (pt === 0)
			return "\n\n/No plugins installed/";
		var pg=[];
		for(var i=0;i < pt;++i){
			pg.push("* [[WoaS::Plugins::"+this._all[i]+"|"+this._all[i]+"]]"+
					//TODO: some CSS for the plugin actions
					"&nbsp;&nbsp;[[Javascript::woas.plugins.remove('"+this._all[i]+"')|Delete]]"+
					"&nbsp;&nbsp;[[Javascript::woas._edit_plugin('"+this._all[i]+"')|Edit...]]"+
					"\n");
		}
		return "\n\n"+woas._simple_join_list(pg);
	},
	
	describe_external: function(uris) {
		// show a list of external sources
		var ntext = "<"+"p>This plugin is made up of the following external sources:<"+"/p><"+"ul>", uri;
		for(var i=0;i < uris.length;++i) {
			ntext += "<"+"li>" + "<"+"big>"+(uris[i].is_inline ? "(inline)" : "(external)")+"<"+"/big>&nbsp;";
			ntext += "<"+"a href=\""+uris[i].src+"\" target=\"_blank\">"+uris[i].src+"<"+"/a><"+"/li>\n";
		}
		return ntext+"<"+"/ul>";
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
			return false;
		// first we attempt to disable it, ignoring failure (because it could just not be active)
		this.disable(name);
		woas.delete_page(page_name);
		// remove from array
		var i = this._all.indexOf(name);
		this._all.splice(i,1);
		if (current === "WoaS::Plugins") {
			//HACK: reload plugins
			woas.setHTMLDiv(d$("woas_wiki_area"), woas.parser.parse(woas.get_text("WoaS::Plugins") + this.list()));
		}
		return true;
	}

};

// @module hotkey
woas.hotkey = {
	
	all: {
		"save":		"s",
		"edit":		"e",
		"print":	"p",
		"help":		"h",
		"goto":		"g",
		"cancel":	0x1b,
		"back":		0x8
	},
	cached_default: null,
	custom_accesskeys: [],

	_update_accesskeys: function(new_custom_accesskeys) {
		var ak, a, b, at, bt;
		// we store the length of old access keys before looping because
		// other entries might be added during the cycles
		bt=this.custom_accesskeys.length;
		for(a=0,at=new_custom_accesskeys.length;a < at;++a) {
			found = false;
			for (b=0;b < bt;++b) {
				// access key already exists
				if (this.custom_accesskeys[b].key === new_custom_accesskeys[a].key) {
					found = true;
					break;
				}
			}
			// proceed to addition
			if (!found) {
				ak = document.createElement("a");
				this._hook_fn(ak, new_custom_accesskeys[a].fn);
				ak.accessKey = new_custom_accesskeys[a].key;
				// store the new access key
				this.custom_accesskeys.push({"fn":new_custom_accesskeys[a].fn,"key":new_custom_accesskeys[a].key,
											 "obj":ak});
				d$("woas_custom_accesskeys").appendChild(ak);
			}
		}
		// (3) clear the div content if no custom access key is there (just for safety)
		if (this.custom_accesskeys.length === 0)
			this.setHTML(d$("woas_custom_accesskeys"), "&nbsp;");
	},
	
	_hook_fn: function(obj, fn) {
		woas.log("setting onclick for "+fn);
		if (woas.browser.gecko || woas.browser.webkit)
			obj.setAttribute("onclick", fn+"()");
		else //HACK
			obj.onclick = eval(fn);
	},

	// return the default hotkeys/key bindings
	_cache_default: function() {
		if (this.cached_default === null) {
			this.cached_default="";
			var k;
			for(var hkey in this.all) {
				k = this.all[hkey];
				switch(typeof k) {
					case "string":
					break;
					default: // Number
						k = "0x"+k.toString(16);
				}
				this.cached_default += "$"+hkey.toUpperCase()+"\t"+k+"\n";
			}
		}
		return this.cached_default;
	},

	validate: function(k) {
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
	},

	load: function(s) {
		var new_custom_accesskeys=[];
		// identify valid alias lines and get the key binding/hotkey
		s.replace(this.reHotkeys, function(str, hkey, lambda, binding) {
			// check that binding is a valid key
			binding = woas.hotkey.validate(binding);
			if (binding === null) {
				woas.log("Skipping invalid key binding for hotkey "+hkey);	//log:1
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
				if (typeof woas.hotkey.all[hkey] == "undefined") {
					woas.log("Skipping unknown hotkey "+hkey);	//log:1
					return;
				}
				// associate hotkey and key binding
				woas.hotkey.all[hkey] = binding;
			}
		});
		// once finished loading hotkey definitions, associate them
		d$("woas_save_hl").accessKey = this.all.save;
		d$("woas_edit_hl").accessKey = this.all.edit;
		d$("woas_print_hl").accessKey = this.all.print;
		d$("woas_help_hl").accessKey = this.all.help;
		// set access key for goto feature
		new_custom_accesskeys.push({fn:"woas.cmd_go_to", key: this.all.goto});
		
		// (1) delete access keys which no more exist
		var found,a,b;
		for(a=0,at=this.custom_accesskeys.length;a < at;++a) {
			found = false;
			for (b=0,bt=new_custom_accesskeys.length;b < bt;++b) {
				if (this.custom_accesskeys[a].key === new_custom_accesskeys[b].key) {
					found = true;
					// access key element was found, update the associated function (if necessary)
					if (this.custom_accesskeys[a].fn !== new_custom_accesskeys[b].fn) {
						this._hook_fn(this.custom_accesskeys[a].obj, new_custom_accesskeys[b].fn);
					}
					break;
				}
			}
			// proceed to removal
			if (!found) {
				d$("woas_custom_accesskeys").removeChild(this.custom_accesskeys[a].obj);
				delete this.custom_accesskeys[a].obj;
				this.custom_accesskeys.splice(a,1);
				--at;
			}
		}
		// (2) add new access keys
		this._update_accesskeys(new_custom_accesskeys);
	},
	
	reHotkeys: /^\$([A-Za-z0-9_]{2,})(\([A-Za-z0-9_]+\))?\s+([\S]+)\s*$/gm
};

// call once during code setup to store the current default hotkeys
woas.hotkey._cache_default();

woas._edit_plugin = function(name) {
	if (this.go_to("WoaS::Plugins::"+name))
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
	for(var i=0,l=this.aliases.length;i < l;++i) {
		aliased_title = aliased_title.replace(this.aliases[i][0], this.aliases[i][1]);
	}
	return aliased_title;
};

woas.macro = {
	// macro definition regex
	reMacroDef: /^(%?[A-Za-z0-9_\.]+)\s*(\(.*?\))?\s*:([\s\S]*)$/,

	// macro syntax plugin code adapted from FBNil's implementation
	parser: function(text){
		// standard macro object
		var macro = { "reprocess": false, "text": text };
		// match macro definition/call
		var M=text.match(this.reMacroDef);
		// if no double colon declaration was found, then do not process anything
		if (M !== null) {
			var fn = M[1];
			// check validity of macro name
			if ((fn.indexOf("..") !== -1) || (fn.charAt(0) === '.') ||
				(fn.charAt(fn.length-1) === '.')) {
					woas.log("Invalid macro name: "+fn);	//log:1
					return macro;
			}
			// check if this is a macro definition request
			if (fn.charAt(0) === '%') {
				fn = fn.substr(1);
				// when macro is not defined, define it
				if (this.create(fn, M[2], M[3])) {
					// we totally remove the block
					macro.reprocess = false;
					macro.text = "";
		//			macro.text = "<!-- defined "+fn+" macro -->";
				} else { // set some error message
					macro.reprocess = false;
					macro.text = woas.parser._make_preformatted(M[0], "color:red;font-weight:bold");
				}
				return macro;
			}
			var fi = this.names.indexOf(fn);
			if (fi !== -1) {
				macro.text = M[3];
				// if we have no parameters, direct call function
				var pl, rv;
				if (typeof M[2] == "undefined")
					pl = 0;
				else pl = M[2].length;
				try {
					if (pl === 0)
						(this.functions[fi])(macro);
					else {
						// inline insertion of parameters
						// cannot use woas.eval because we need context for 'macro'
						rv = eval( "(woas.macro.functions["+fi+"])"+
									"(macro,"+M[2].substr(1,pl-2)+");"
							);
					}
				}
				catch(e) {
					woas.log("Error during macro execution: "+e);
				}
				// analyze return value
				if (typeof rv == "undefined")
					woas.log("WARNING: "+this.names[fi]+" did not return any value");
				else {
					// when macro returns false we automatically highlight it
					if (!rv) {
						macro.reprocess = false;
						macro.text = woas.parser._make_preformatted(M[0], "color:red;font-weight:bold");
					}
				}
			} else {
				woas.log("Undefined macro "+fn);	//log:1
				macro.text = woas.parser._make_preformatted(macro.text, "color:red");
			}
		}
		return macro;
	},

	// this is the function to be called to register a  macro
	// each macro function must accept a macro object as parameter and modify
	// such object (it is always passed by reference)
	register: function(fn_name, fn_object) {
		if (this.names.indexOf(fn_name) != -1) {
			woas.log("cannot redefine macro "+fn_name); //log:1
			return false;
		}
		this.names.push(fn_name);
		this.functions.push(fn_object);
		return true;
	},

	// some default macros
	default_macros: {
		// advanced transclusion: each newline creates a parameter
		"include" : function(m) {
			var params = m.text.split("\n");
			// embedded transclusion not supported
			if (!params.length || !woas.page_exists(params[0]) || woas.is_embedded(params[0]))
				return false;
			var nt = woas.get_text_special(params[0]);
			if (nt === null)
				return false;
			if (params.length) { // replace transclusion parameters
				nt = nt.replace(/%\d+/g, function(str) {
					var paramno = parseInt(str.substr(1));
					if (paramno < params.length)
						return params[paramno];
					else
						return str;
					} );
			}
			m.text = nt;
			m.reprocess = true;
			return true;
		}
	},

	// the name of macros as they are called from wiki text
	names: [],
	// the actual function objects being called
	functions: [],

	// a reduced charset for javascript argument names
	reFindArgDef: /([a-z0-9_]+)\s*,/gi,
	reFindArgDefLast: /([a-z0-9_]+)\s*$/gi,
	create: function(fn_name, fn_params, fn_code) {
		// duplicated from register function
		if (this.names.indexOf(fn_name) != -1) {
			woas.log("cannot redefine macro "+fn_name); //log:1
			return false;
		}
		// prepare for passing other params
		// parameter definitions can be very limited in charset
		var real_params=[], other_params = "";
		if (((typeof fn_params).toLowerCase() == "string") && fn_params.length) {
			// remove parenthesis
			fn_params = fn_params.substr(1, fn_params.length-2);
			this.reFindArgDef.lastIndex = 0;
			fn_params.replace(this.reFindArgDef, function(str, pname) {
				real_params.push(pname);
			});
			
			this.reFindArgDefLast.lastIndex = this.reFindArgDef.lastIndex;
			fn_params.replace(this.reFindArgDefLast, function(str, pname) {
				real_params.push(pname);
			});
		}

		if (real_params.length)
			other_params = ","+real_params.join(",");
		else other_params = "";
		var obj = woas.eval("function (macro"+other_params+") {\n"+fn_code+"\n}", true);
		if (woas.eval_failed) {
			woas.log("cannot define function "+fn_name+": "+woas.eval_fail_msg); //log:1
			return false;
		}
		return this.register(fn_name, obj);
	},
	
	// code used to save backups of macro definitions
	// called by parser
	_backup: [],
	push_backup: function() {
		this._backup.push(this.names.slice(0));
		this._backup.push(this.functions.slice(0));
	},
	
	pop_backup: function() {
		this.functions = this._backup.pop();
		this.names = this._backup.pop();
	},
	
	has_backup: function() {
		return (this._backup.length !== 0);
	}

}; // end of woas.macro module

// some initialization
woas.macro.names.push("woas.include");
woas.macro.functions.push(woas.macro.default_macros.include);
