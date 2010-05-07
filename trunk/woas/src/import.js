// skeleton for the 'importer' module
woas.importer = {
};

// regular expressions used to not mess with title/content strings
var reRequote = new RegExp(":-"+parse_marker, "g"),
	reJString = new RegExp("'[^']*'", "g"),
	reJStringRep = new RegExp(parse_marker+":"+"(\\d+)", "g");

woas._file_ext = function(fn) {
	var m=fn.match(/\.(\w+)$/);
	if (m === null) return "";
	return "."+m[1];
};

// applies some on-the-fly patches for the syntax changes in v0.9
function _new_syntax_patch(text) {
	//BUG: will also modify text contained in nowiki blocks!
	text = text.replace(/(^|\n)(\+*)([ \t])/g, function (str, $1, $2, $3) {
		return $1+String("*").repeat($2.length)+$3;
	});
	
	return text;
}

/* NOTES ABOUT BACKWARD IMPORT SUPPORT
		0.12.0:
			* introduced some config options: new_tables_syntax, store_mts, folding_style
			* introduced plugins (which deprecate WoaS::Bootscript)
			* dropping support for all WoaS before 0.9.6B
		0.11.2:
			* introduced parsing mechanism which does not mess with var declarations inside JavaScript strings
			* introduced WoaS::Hotkeys, WoaS::CSS::Core, WoaS::CSS::Custom
			* introduced woas.config.safe_mode option
			* introduced woas.config.wsif_ds* options
		0.10.7:
			* introduced WoaS::Plugins and changed WoaS::Bootscript page type from embedded to normal
		0.10.0:
			* introduced page_mts for global page modified timestamp
		0.9.7:
			* introduced WoaS::Aliases
		0.9.6:
			* Special::Bootscript -> WoaS::Bootscript
		0.9.5D (not released)
			* Javascript:: reserved namespace
			* some Special:: pages no more work
		0.9.5B
			* object orientation of code
			* server_mode disappears
		0.9.4B
			* introduced Special::Bootscript
*/

var reValidImage = /^data:\s*[^;]*;\s*base64,\s*/,
	reOldStyleBlock = new RegExp("<"+"style\\s.*?type=\"?text\\/css\"?[^>]*>((\\n|.)*?)<"+"\\/style>", "i");
woas.import_wiki = function() {

	// function used to collect variables
	function get_import_vars(data, ignore_array) {
		var container={},	// extracted data container
			jstrings=[];
		// (1) take away all javascript strings (most notably: content and titles)
		// WARNING: quoting hacks lie here!
		data = data.replace(/\\'/g, ":-"+parse_marker).replace(reJString, function (str) {
			// restore quotes
			jstrings.push(str.substr(1, str.length-2).replace(reRequote, "\\'"));
			return parse_marker+":"+(jstrings.length-1).toString();
		});
		var defs=[];
		// (2) rename the variables
		data.replace(/([^\\])\nvar\s+(\w+)\s*=\s*([^;]+);/g, function (str, $1, $2, definition) {
			if (ignore_array) {
				// it must not be in array
				if (ignore_array.indexOf($2) !== -1)
					return;
			}
			// OK, we want this variable, grab it
			defs.push($2);
			container[$2] = woas.eval(definition.replace(reJStringRep,
								function (str, id) { return "'"+jstrings[id]+"'";}
							), true);
		}); data = null;
		log("collected variables = "+defs);	// log:1
		// this shall not collide with woas variables found in javascript data block
		container.defs = defs;
		return container;
	}

	if(confirm(this.i18n.CONFIRM_IMPORT_OVERWRITE) === false)
		return false;

	// set hourglass
	this.progress_init("Import WoaS");
	
	var sys_pages=0,
		fail=false,
		page_names = [],
		pages_imported = 0,
		bootscript_code = "",	// collected bootscript code
		update_aliases = false,
		update_hotkeys = false,
		plugins_update = [],
		plugins_add = [],
		css_was_imported = false;

	do { // a fake do...while to ease failure return
	// file will be loaded as ASCII to overcome browsers' limitations
	var ct = this.load_file(null, this.file_mode.ASCII_TEXT);
	if (ct === null) {
		fail = true;
		break;
	}
	if (ct === false) {
		this.alert(this.i18n.LOAD_ERR);
		fail = true;
		break;
	}
	
	var import_css = $('cb_import_css').checked,
		import_content = $('cb_import_content').checked;
	
	// get WoaS version
	var old_version,
		ver_str = ct.match(/var woas = \{"version":\s+"([^"]+)"\s*\};(\r\n|\n)/);
	if (!ver_str || !ver_str.length) {
		this.alert("Could not determine WoaS version\n"+this.i18n.IMPORT_OLD_VER);
		fail = true;
		break;
	}
	ver_str = ver_str[1];
	log("Version string: "+ver_str);	// log:1
	switch (ver_str) {
		case "0.9.6B":
		case "0.9.7B": // never released officially
			ver_str = ver_str.substr(0, ver_str.length-2);
		case "0.10.0": case "0.10.1":
		case "0.10.2": case "0.10.3":
		case "0.10.4": case "0.10.5":
		case "0.10.6": case "0.10.7":
		case "0.10.8": case "0.10.9":
		case "0.11.0": case "0.11.1":
		case "0.11.2": case "0.11.3":
		case "0.11.4": case "0.11.5":
		case "0.11.6": case "0.11.7":
		case "0.11.8": case "0.11.9":
		case "0.12.0":
		old_version = Number(ver_str.substr(2).replace(/\./g, ""));
			break;
		default:
			this.alert(this.i18n.IMPORT_INCOMPAT.sprintf(ver_str)+this.i18n.IMPORT_OLD_VER);
			fail=true;
	}
	if (fail) break;

	// import the variables
	var new_main_page = this.config.main_page,
		page_contents = [],
		old_page_attrs = [],
		old_page_mts = [],
		pc = 0,
		i, il, pi,
		imported_css = null,
		// used during import from older versions
		old_cfg = $.clone(this.config);

	// locate the random marker
	var old_marker = ct.match(/\nvar __marker = "([A-Za-z\-\d]+)";(\r\n|\n)/);
	if (!old_marker) {
		this.alert(this.i18n.ERR_MARKER);
		fail = true;
	}
	if (fail) break;
	old_marker = old_marker[1];

	// import the CSS head tag in versions before 0.11.2
	if (import_css && (old_version < 112)) {
		ct.replace(reOldStyleBlock, function (str, $1) {
			imported_css = $1;
		});
		if (imported_css !== null) {
			log("Imported "+imported_css.length+" bytes of CSS");	// log:1
			css_was_imported = true;
		}
	} // 0.11.2+, we'll manage CSS import at the page level

	var data = this._extract_src_data(old_marker, ct, true, new_main_page, true),
		collected = [];
		
	// some GC help: we no more need the big content variable
	ct = null;		
	collected = get_import_vars(data, ['woas', '__marker', 'version', '__config']);

	// main_page was not in config object for 0.10.8 and below
	if (old_version <= 108)
		new_main_page = collected.main_page;
	if (import_content) {
		if (old_version > 97)
			old_page_mts = collected.page_mts;
		// copy the big arrays
		page_names = collected.page_titles;
		page_contents = collected.pages;
		old_page_attrs = collected.page_attrs;
	} // do not import content pages

	var cfgStartMarker = 'woas["'+'config"] = {',
		// grab the woas config definition
		cfg_start = data.indexOf(cfgStartMarker),
		cfg_found = false;
	
	if (cfg_start !== -1) {
		var cfg_end = data.indexOf('}', cfg_start+cfgStartMarker.length);
		if (cfg_end !== -1) {
			woas.config = woas.eval(data.substring(cfg_start+cfgStartMarker.length-1, cfg_end+1), true);
			cfg_found = !woas.eval_failed;
		}
	}
				
	if (!cfg_found) {
		woas.log("Failed to import old configuration object");
	} else {
		// add the new debug option
		if (old_version<=107)
			woas.config.debug_mode = old_cfg.debug_mode;
		// add the new safe mode and WSIF DS options
		if (old_version < 112) {
			woas.config.safe_mode = old_cfg.safe_mode;
			woas.config.wsif_author = old_cfg.wsif_author;
			woas.config.wsif_ds = old_cfg.wsif_ds;
			woas.config.wsif_ds_lock = old_cfg.wsif_ds_lock;
			woas.config.wsif_ds_multi = old_cfg.wsif_ds_multi;
		}
		if (old_version < 120) {
			woas.config.new_tables_syntax = old_cfg.new_tables_syntax;
			woas.config.store_mts = old_cfg.store_mts;
			woas.config.folding_style = old_cfg.folding_style;
		}
		// check for any undefined config property - for safety
		for(p in woas.config) {
			if ((typeof woas.config[p] == "undefined") && (typeof old_cfg[p] != "undefined"))
				woas.config[p] = old_cfg[p];
		}

	} // done importing config object
		
	// some GC help
	data = null;

	// modified timestamp for pages before 0.10.0
	var current_mts = Math.round(new Date().getTime()/1000);
	
	// **** COMMON IMPORT CODE ****
	if (import_content) {
		// add new data
		for (i=0, il=page_names.length; i < il; i++) {
			// we are not using is_reserved() because will be inconsistant in case of enabled edit_override
			// check pages in WoaS:: namespace
			if (page_names[i].substr(0,6) === "WoaS::") {
				// do not overwrite help pages with old ones
				if (page_names[i].indexOf("WoaS::Help::") === 0)
					continue;
				// skip other core WoaS:: pages
				if (this.static_pages2.indexOf(page_names[i]) !== -1)
					continue;
				var is_css_page = (page_names[i] === "WoaS::Custom::CSS");
				// custom CSS is allowed only when importing CSS
				if (!import_css && is_css_page)
					continue;
				else if (import_css && is_css_page)
					css_was_imported = true;
				// fix the old bootscript page
				if (old_version < 120) {
					if (page_names[i] === "WoaS::Bootscript") {
						// convert old base64 bootscript to plain text
						if (old_version < 107)
							bootscript_code = decode64(page_contents[i]);
						else
							bootscript_code = page_contents[i];
						pages_imported++;
						this.progress_status(pages_imported/page_names.length);
						continue;
					}
				} // from 0.12.0 we no more have a bootscript page
				// take note of plugin pages
				var _pfx = "WoaS::Plugins::";
				if (page_names[i].substr(0, _pfx.length) === _pfx) {
					// does plugin already exist?
					if (page_titles.indexOf(page_names[i])!==-1)
						plugins_update.push(page_names[i].substr(_pfx.length));
					else
						plugins_add.push(page_names[i].substr(_pfx.length));
				} else if (page_names[i] === "WoaS::Aliases")
				// check if we need to update aliases and hotkeys
					update_aliases = true;
				else if (page_names[i] === "WoaS::Hotkeys")
					update_hotkeys = true;
				// allowed pages after above filtering are Plugins, Aliases, Hotkeys
			} else if (page_names[i].indexOf("Special::")===0) {
				if (old_version===96) {
					if (page_names[i]=="Special::Bootscript") {
						bootscript_code = page_contents[i];
						pages_imported++;
						this.progress_status(pages_imported/page_names.length);
						continue;
					}
				}
				// here we are skipping special pages
				++sys_pages;
				continue;
			} else { // not importing a special page
				
				// check that imported image is valid
				if (old_page_attrs[i] & 8) {
					// the image is not valid as-is, attempt to fix it
					if (!reValidImage.test(page_contents[i])) {
						// do not continue with newer versions or if not base64-encoded
						if ((old_version>=117) || !reValidBase64.test(page_contents[i])) {
							log("Skipping invalid image "+page_names[i]);
							continue;
						}
						// try to get a mime type from extension (sigh!)
/*						var mime = this._file_ext(page_names[i]);
						if (!mime.length)
							// hack
							mime = "png";
						else {
							mime = mime.substr(1).toLowerCase();
							if (mime === "jpg") mime = "jpeg";
						}
						// finally rebuild image as valid
						page_contents[i] = "data:image/"+mime+";base64,"+page_contents[i]; */
						// we assume that image is double-encoded
						page_contents[i] = decode64(page_contents[i]);
						// check again for validity
						if (!reValidImage.test(page_contents[i])) {
							log("Skipping invalid image "+page_names[i]); //log:1
							continue;
						}
						log("Fixed double-encoded image "+page_names[i]); //log:1
					}
				}
			} // not importing a special page
//			log("Now importing "+page_names[i]); //log:0
			pi = this.page_index(page_names[i]);
			if (pi === -1) {
				page_titles.push(page_names[i]);
				pages.push(page_contents[i]);
				page_attrs.push( old_page_attrs[i] );
				if (old_version < 100)
					page_mts.push( this.config.store_mts ? current_mts : 0);
				else
					page_mts.push( this.config.store_mts ? old_page_mts[i] : 0);
			} else { // page already existing
//				log("replacing "+page_names[i]);	//log:0
				page_titles[pi] = page_names[i];
				// fix the trailing nul bytes bug in encrypted pages
				if ((old_version>=102) && (old_version<=103)
					&& (old_page_attrs[i] & 2)) {
						var rest = page_contents[i].length % 16;
						if (rest)
						log("removing "+rest+" trailing bytes from page "+page_names[i]); //log:1
						while (rest-- > 0) {page_contents[i].pop();}
				}
				// copy content
				pages[pi] = page_contents[i];
				page_attrs[pi] = old_page_attrs[i];
			}
			++pages_imported;
			this.progress_status(pages_imported/page_names.length);
		} // for cycle
		// added in v0.9.7
	} // do not import content pages
	
	// eventually add the new missing page
	if (old_version <= 112) {
		// take care of custom CSS (if any)
		if (imported_css !== null) {
			pi = page_titles.indexOf("WoaS::CSS::Custom");
			pages[pi] = imported_css;
		}
	}
	// set the new config variable
	if (old_version<=108)
		this.config.main_page = old_cfg.main_page;
	// apply the new main page if that page exists
	if ((new_main_page !== old_cfg.main_page) && this.page_exists(new_main_page))
		this.config.main_page = new_main_page;
	
	} while (false); // fake do..while ends here
	
	// fix configuration for older versions
	if (old_version < 114) {
		if (!this.config.nav_history) {
			// reset some variables which were not reset in those older versions
			backstack = [];
			current = this.config.main_page;
		}
	}
	
	// refresh in case of CSS, aliases and/or hotkeys modified
	if (css_was_imported)
		this.css.set(this.get_text("WoaS::CSS::Core")+"\n"+this.get_text("WoaS::CSS::Custom"));
	if (update_aliases)
		this._load_aliases(this.get_text("WoaS::Aliases"));
	if (update_hotkeys)
		this._load_hotkeys(this.get_text("WoaS::Hotkeys"));
	
	// add/update plugins
	for(var i=0,it=plugins_update.length;i < it;++i) {
		this.plugins.update(plugins_update[i]);
	}
	for(var i=0,it=plugins_add.length;i < it;++i) {
		this.plugins.enable(plugins_add[i]);
	}
	
	// if there is bootscript code, create a new plugin for it
	// skip empty bootscripts and also default bootscript
	var trimmed_bs = this.trim(bootscript_code);
	if ((trimmed_bs.length !== 0) && (trimmed_bs !== '/* insert here your boot script */')
		&& (trimmed_bs !== '// Put here your boot javascript')) {
		var chosen_name = "WoaS::Plugins::Bootscript", base_name = chosen_name, i=0;
		while (page_titles.indexOf(chosen_name) !== -1) {
			chosen_name = base_name + "_" + (i++).toString();
		}
		// now create such plugin
		page_titles.push(chosen_name);
		pages.push("/* This JavaScript code was automatically imported by WoaS from your former WoaS::Bootscript */\n"+bootscript_code);
		page_attrs.push( 0 );
		page_mts.push( this.config.store_mts ? current_mts : 0);
		log("Old bootscript code has been saved in "+chosen_name);
	}
	
	// remove hourglass
	this.progress_finish();
	
	// return false on failure
	if (fail)
		return false;

	// inform about the imported pages / total pages present in file
	this.alert(this.i18n.IMPORT_OK.sprintf(pages_imported+"/"+(page_names.length-sys_pages).toString(), sys_pages));
	
	// move to main page
	current = this.config.main_page;
	// save everything
	this.full_commit();
	
	this.refresh_menu_area();
	this.set_current(this.config.main_page, true);
	
	// supposedly, everything went OK
	return true;
};

/*** generic import code follows ***/

var _wsif_js_sec = {
	"comment_js": true,
	"comment_macros": true,
	"woas_ns": true
};

// apply some javascript security settings
function _import_wsif_pre_hook(NP) {
	// always import special pages because filtering is handled in wsif.js
	if (NP.title.indexOf("Special::")===0)
		return true;
	// check if page needs to be skipped
	if (_wsif_js_sec.woas_ns) {
		if (NP.title.indexOf("WoaS::")===0)
			return false;
	} else {
		// directly import these pages
		if (NP.title.indexOf("WoaS::")===0)
			return true;
	}
	// only plain wiki and locked pages can be hotfixed
	if (NP.attrs > 1)
		return true;
	// comment out all javascript blocks
	var snippets = [];
	// put away text in nowiki blocks
	var page = NP.page.replace(reNowiki, function (str, $1) {
		var r = "<"+"!-- "+parse_marker+"::"+snippets.length+" --"+">";
		snippets.push($1);
		return r;
	});
	if (_wsif_js_sec.comment_js) {
		page = page.replace(reScripts, "<"+"disabled_script$1>$2<"+"/disabled_script>");
		NP.modified = true;
	}
	if (_wsif_js_sec.comment_macros) {
		page = page.replace(reMacros, "<<< Macro disabled\n$1>>>");
		NP.modified = true;
	}
	if (NP.modified) {
		// put back in place all HTML snippets
		if (snippets.length>0) {
			NP.page = page.replace(new RegExp("<\\!-- "+parse_marker+"::(\\d+) -->", "g"), function (str, $1) {
				return "{{{"+snippets[parseInt($1)]+"}}}";
			});
		} else
			NP.page = page;
	}
	return true;
}
