
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

var reValidImage = /^data:\s*[^;]*;\s*base64,\s*/;
woas.import_wiki = function() {

	// function used to collect variables
	function get_import_vars(data, ignore) {
		var c=[], jstrings=[];
		// (1) take away all javascript strings (most notably: content and titles)
		// WARNING: quoting hacks lie here!
		data = data.replace(/\\'/g, ":-"+parse_marker).replace(reJString, function (str) {
			// restore quotes
			jstrings.push(str.substr(1, str.length-2).replace(reRequote, "\\'"));
			return parse_marker+":"+(jstrings.length-1).toString();
		});
		// (2) rename the variables
		data = data.replace(/([^\\])\nvar (\w+) = /g, function (str, $1, $2) {
			if (ignore && ignore.indexOf($2)!=-1)
				return "\nvar ignoreme = ";
			c.push('sw_import_'+$2);
			return $1+"\nvar sw_import_"+$2+" = ";
		});//.replace(/\\\n/g, '');
		log("collected variables = "+c);	// log:1
		// (3) expand the javascript strings
		data = data.replace(reJStringRep, function (str, id) {
			return "'"+jstrings[id]+"'";
		});
		// (4) directly parse the javascript and return it
		c = eval(data+"\n["+c+"];");
		return c;
	}

	if(confirm(this.i18n.CONFIRM_IMPORT_OVERWRITE) === false)
		return false;

	// set hourglass
	this.progress_init("Import WoaS");
	
	var fail=false;
	var sys_pages=0,
		page_names = [],
		pages_imported = 0;

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
	
	var import_css = $('cb_import_css').checked;
	var import_content = $('cb_import_content').checked;
	//TODO: import icon support
	var import_icons = $('cb_import_icons').checked;
	
	// get WoaS version
	var old_version;
	var ver_str = ct.match(/<div .*?id=("version_"|version_).*?>([^<]+)<\/div>/i);
	if (ver_str && ver_str.length>1) {
		ver_str = ver_str[2];
		log("Importing wiki with version string \""+ver_str+"\"");	// log:1
		switch(ver_str)	{
			case "0.03":
				old_version = 3;
				break;
			case "0.04": 
			case "0.04G":
				old_version = 4;
				break;
			default:
				this.alert(this.i18n.IMPORT_INCOMPAT.sprintf(ver_str));
				fail=true;
		}
		if (fail) break;
	} else {
		ver_str = ct.match(/var version = "([^"]*)";(\r\n|\n)/);
		if (!ver_str)
			ver_str = ct.match(/var woas = \{"version":\s+"([^"]+)"\s*\};(\r\n|\n)/);
		if (ver_str && ver_str.length) {
			ver_str = ver_str[1];
			log("Version string: "+ver_str);	// log:1
			switch (ver_str) {
				case "0.9B":
				case "0.9":
					old_version = 9;
				break;
				case "0.9.2B":
					old_version = 92;
				break;
				case "0.9.3B":
					old_version = 93;
				break;
				case "0.9.4B":
					old_version = 94;
				break;
				case "0.9.5B":
				case "0.9.5C":
//				case "0.9.5D": // development only
					old_version = 95;
				break;
				case "0.9.6B":
//				case "0.9.6C": // development only
					old_version = 96;
					break;
				case "0.9.7B": // never released officially
//				case "0.9.6C": // development only
					old_version = 97;
					break;
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
					old_version = Number(ver_str.substr(2).replace(/\./g, ""));
					break;
				default:
					this.alert(this.i18n.IMPORT_INCOMPAT.sprintf(ver_str));
					fail=true;
			}
		if (fail) break;
		} else { // below code is not very solid!
//			log("Maybe version 0.02? Please report as a bug");	// log:2
			old_version = 2;
			if (ct.match("<div id=\"?"+escape("Special::Advanced")))
				old_version = 3;
		}
	}

	// import the variables
	var new_main_page = this.config.main_page,
		old_block_edits = !this.config.permit_edits,
		page_contents = [],
		old_page_attrs = [],
		old_page_mts = [],
		pc = 0,
		i, il, pi,
		imported_css = null,
		// used during import from older versions
		old_cfg = {"debug_mode":this.config.debug_mode,
				"wsif_ds":this.config.wsif_ds,
				"wsif_ds_multi":this.config.wsif_ds_multi,
				"wsif_ds_lock":this.config.wsif_ds_lock,
				"safe_mode":this.config.safe_mode,
				"wsif_author":this.config.wsif_author,
				"main_page":this.config.main_page
				};

	// old versions parsing
	if (old_version	< 9) {

		var wiki;
		try {
			wiki = ct.match(/<div .*?id=(wiki|"wiki")[^_\\]*?>((.|\n|\t|\s)*)<\/div>/i)[0];
		} catch(e) {
			this.alert(this.i18n.IMPORT_UNRECON);
			fail = true;
		}
		if (fail) break;
		
		// eliminate comments
		wiki = wiki.replace(/\<\!\-\-.*?\-\-\>/g, "");
		
		// separate variables from wiki
		var vars;
		var p = wiki.search(/<div .*?id=("variables"|variables)[^>]*?>/i);
		if (p!=-1) {
			vars = wiki.substring(p);
			wiki = wiki.substring(0, p);
		} else
			vars = "";
		
		if(old_version == 2) {
			try {
				vars = wiki.match(/\<div .*?id=("main_page"|main_page)>(.*?)\<\/div\>/i)[1];
			} catch(e) {
	//			log("No variables found");	// log:0
			}
		}
		
		/* NOTES ABOUT OLD VERSIONS
		v0.11.2:
			* introduced parsing mechanism which does not mess with var declarations inside JavaScript strings
			* introduced WoaS::Hotkeys, WoaS::CSS::Core, WoaS::CSS::Custom
			* introduced woas.config.safe_mode option
			* introduced woas.config.wsif_ds* options
		v0.10.7:
			* introduced WoaS::Plugins and changed WoaS::Bootscript page type from embedded to normal
		v0.10.0:
			* introduced page_mts for global page modified timestamp
		v0.9.7:
			* introduced WoaS::Aliases
		v0.9.6:
			* Special::Bootscript -> WoaS::Bootscript
		v0.9.5D (not released)
			* Javascript:: reserved namespace
			* some Special:: pages no more work
		v0.9.5B
			* object orientation of code
			* server_mode disappears
		v0.9.4B
			* introduced Special::Bootscript
		v0.04
			* permit_edits variable appeared here
		v0.02
			* pages were not escaped
		*/


		// get an array of variables and wikis
		var var_names = [];
		var var_values = [];
		var vc = 0;

		// eliminate headers
		wiki = wiki.substring(wiki.indexOf(">")+1);
		vars = vars.substring(vars.indexOf(">")+1);
		
		vars.replace(/<div id="?(version_|main_page_|permit_edits_|[\w_]+)"?>((\n|.)*?)<\/div>/gi, function(str, $1, $2) {
					if(old_version == 2)
						var_names[vc] = "main_page_";
					else
						var_names[vc] = $1;
					var_values[vc] = $2;
					vc++;
				});
		
	//	log("Variables are ("+var_names+")");	// log:0

		// now extract the pages from old versions < 0.9
		if (import_content) {
			wiki.replace(/<div .*?id="?([^">]+)"?>((\n|.)*?)<\/div>/gi, function(str, $1, $2, $3) {
	//				log("Parsing old page "+$1);	// log:0
					if (old_version != 2) {
						page_names[pc] = unescape($1);
						page_contents[pc] = unescape($2);
					} else {
						page_names[pc] = $1;
						page_contents[pc] = $2;
					}
					// throw away old special pages
					if (page_names[pc].indexOf("Special::")===0) {
						if (page_names[pc].search(/Special::Edit Menu/i)===0)
							page_names[pc] = "::Menu";
						else {
							++sys_pages;
							return;
						}
					}
					
					old_page_attrs[pc] = 0;

					if (old_version < 9) {	// apply compatibility changes to stickwiki versions below v0.9
						page_contents[pc] = _new_syntax_patch(page_contents[pc].replace(new RegExp("(\\[\\[|\\|)Special::Import wiki\\]\\]", "ig"), "$1Special::Import]]").replace(/\[\[([^\]\]]*?)(\|([^\]\]]+))?\]\]/g,
						function (str, $1, $2, $3) {
							if ($3)
								return "[["+$3+"|"+$1+"]]";
							else
								return str;
						}));
					}
					pc++;
				}
				);

	//		log("page_names is ("+page_names+")");	// log:0
		} // do not import content pages

		for (i=0,il=var_names.length;i<il;++i) {
			if (var_names[i] == "main_page_")
				new_main_page = (old_version!=2) ? unescape(var_values[i]) : var_values[i];
			else if (var_names[i] == "permit_edits")
				old_block_edits = (var_values[i]=="0");
		}
		
	} else {	// we are importing a v0.9.x Beta

		// locate the random marker
		var old_marker;
		try {
			old_marker = ct.match(/\nvar __marker = "([A-Za-z\-\d]+)";(\r\n|\n)/)[1];
		} catch (e) {
			this.alert(this.i18n.ERR_MARKER);
			fail = true;
		}
		if (fail) break;

		if (import_css) {
			// import the CSS head tag in versions before 0.11.2
			if (old_version < 112) {
				ct.replace(/<style\s.*?type="?text\/css"?[^>]*>((\n|.)*?)<\/style>/i, function (str, $1) {
					imported_css = $1;
				});
				if (imported_css !== null) {
					log("Imported "+imported_css.length+" bytes of CSS");	// log:1
//					this.css.set(css);
				}
			} // 0.11.2+, we'll manage CSS import at the page level
		}

		var data = this._extract_src_data(old_marker, ct, true, new_main_page, true);
		var collected = [];
		
		// for versions before v0.9.2B
		if (old_version < 92) {
			collected = get_import_vars(data);
			data = ct = null;

			var has_last_page_flag = (collected.length==14) ? 1 : 0;
			if (!has_last_page_flag && (collected.length!=13)) {
				this.alert(this.i18n.INVALID_DATA);
				fail=true;
				break;
			}
			
			// set collected config options
			old_block_edits = !collected[2];
			this.config.dblclick_edit = collected[3];
			this.config.save_on_quit = collected[4];
			if (has_last_page_flag)
				this.config.nav_history = collected[5];
			this.config.allow_diff = collected[5+has_last_page_flag];
			this.config.key_cache = collected[6+has_last_page_flag];
			// the gathered data
			new_main_page = collected[8+has_last_page_flag];
			page_names = collected[10+has_last_page_flag];
			old_page_attrs = collected[11+has_last_page_flag];
			page_contents = collected[12+has_last_page_flag];
			
		} else {	// we are importing from v0.9.2 and above which has a config object for all the config flags
		
			// old-style import for content, skipping the main woas object and the marker
			// shared with v0.9.5B
			collected = get_import_vars(data, ['woas', '__marker', 'version', '__config']);

			//0:sw_import_current,1:sw_import_main_page,
			//2:sw_import_backstack,3:sw_import_page_titles,4:sw_import_page_attrs,5:sw_import_pages
			// from 0.10.0: sw_page_mts is before sw_import_pages
			// from 0.10.9: main_page is inside woas.config
			if (old_version <= 108)
				new_main_page = collected[1];
			if (import_content) {
				// offset for missing main_page var
				var ofs_mp = (old_version <= 108) ? 0 : -1;
				if (old_version <= 97)
					page_contents = collected[5+ofs_mp];
				else {
					old_page_mts = collected[5+ofs_mp];
					page_contents = collected[6+ofs_mp];
				}
				page_names = collected[3+ofs_mp];
				old_page_attrs = collected[4+ofs_mp];
				if (old_version===92) {
					// replace the pre tags with the new nowiki syntax
					for (i=0;i<page_contents.length;i++) {
						// page is encrypted, leave it as is
						if (old_page_attrs[i] & 2)
							continue;
						// ignore special pages
						if (page_names[i].indexOf("Special::")===0) {
							++sys_pages;
							continue;
						}
						page_contents[i] = page_contents[i].replace(/<pre(.*?)>((.|\n)*?)<\/pre>/g,
										function (str, $1, $2) {
											var s="{{{"+$2+"}}}";
											if ($1.length)
												s = "<span"+$1+">"+s+"</span>";
											return s;
										});
					}
					// done pre tags fixing
				} // v0.9.2 only
			} // do not import content pages

			// since version v0.9.5B+ we have an object oriented WoaS
			if (old_version >= 95) {
				// rename the members
				collected = [];
				data = data.replace(/([^\\])\nwoas\\["(\w+)"\\] = /g, function (str, $1, $2) {
					collected.push($2);
					return $1+"\ni__woas[\""+$2+"\"] = ";
				});//.replace(/\\\n/g, '');
				data = null;
				
				// retrieve the object containing all woas data & config
				var i__woas = eval(data+"\ni__woas");
				
				// import each member
				for(var a=0,acl=collected.length;a<acl;++a) {
					woas[collected[a]] = i__woas[collected[a]];
				}
				
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
				
				if (import_icons) {
					//TODO: import the icons
				} ct = null;

				i__woas = null;
			} else data=null;
			// DO NOT delete the arrays! They're referenced
	//		collected = null;
		} // done importing from v0.9.2B+
	}

	// modified timestamp for pages before 0.10.0
	var current_mts = Math.round(new Date().getTime()/1000);

	// **** COMMON IMPORT CODE ****
	if (import_content) {
		// add new data
		for (i=0, il=page_names.length; i<il; i++) {
			// we are not using is_reserved() because will be inconsistant in case of enabled edit_override
			// check pages in WoaS:: namespace
			if (page_names[i].indexOf("WoaS::")===0) {
				// do not overwrite help pages with old ones
				if (page_names[i].indexOf("WoaS::Help::")===0)
					continue;
				// skip other core WoaS:: pages
				if (this.static_pages2.indexOf(page_names[i]) !==-1)
					continue;
				// allowed pages after above filtering are Bootscript, Aliases, Hotkeys and CSS::Custom
				if (!import_css && (page_names[i] === "WoaS::Custom::CSS"))
					continue;
			} else if (page_names[i].indexOf("Special::")===0) {
				if ((old_version>=94) && (old_version<=96)) {
					if (page_names[i]=="Special::Bootscript") {
						pi = this.page_index("WoaS::Bootscript");
						pages[pi] = page_contents[i];
						page_attrs[pi] = 4;
						pages_imported++;
						this.progress_status(pages_imported/page_names.length);
						continue;
					}
				}
				// here we are skipping special pages
				++sys_pages;
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
							log("Skipping invalid image "+page_names[i]);
							continue;
						}
						log("Fixed double-encoded image "+page_names[i]);
					}
				}
				pi = this.page_index(page_names[i]);
				if (pi == -1) {
					page_titles.push(page_names[i]);
					pages.push(page_contents[i]);
					page_attrs.push( old_page_attrs[i] );
					if (old_version < 100)
						page_mts.push( current_mts );
					else
						page_mts.push( old_page_mts[i] );
				} else {
					log("replacing "+page_names[i]);
					if (old_version==94) {
						// convert embedded files to base64 encoding
						if (old_page_attrs[i] & 4) {
							// plain copy images, which were already b64-encoded
							if (old_page_attrs[i] & 8)
								pages[pi] = page_contents[i];
							else {
								// page is encrypted, skip it
								if (old_page_attrs[i] & 2)
									continue;
							}
							pages[pi] = encode64(page_contents[i]);
						}
					} else {
						page_titles[pi] = page_names[i];
						// fix the trailing nul bytes bug in encrypted pages
						if ((old_version>=102) && (old_version<=103)
							&& (old_page_attrs[i] & 2)) {
								var rest = page_contents[i].length % 16;
								if (rest)
									log("removing "+rest+" trailing bytes from page "+page_names[i]); //log:1
								while (rest-- > 0) {page_contents[i].pop();}
						}
						// convert old base64 bootscript to plain text
						if ((old_version<107) && (page_titles[pi] == "WoaS::Bootscript")) {
							old_page_attrs[i] = 0;
							pages[pi] = decode64(page_contents[i]);
						} else
							pages[pi] = page_contents[i];
					}
					page_attrs[pi] = old_page_attrs[i];
				}
				++pages_imported;
				this.progress_status(pages_imported/page_names.length);
			} // not importing a special page
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
	
	this.config.permit_edits = !old_block_edits;
	} while (false); // fake do..while ends here
	
	// fix configuration for older versions
	if (old_version < 114) {
		if (!this.config.nav_history) {
			// reset some variables which were not reset in those older versions
			backstack = [];
			current = this.config.main_page;
		}
	}
	
	// remove hourglass
	this.progress_finish();
	
	// when we fail, we return false
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
		// check that the WoaS::Bootscript is in proper format
		if ((NP.title == "WoaS::Bootscript") && (NP.attrs == 4)) {
			NP.attrs = 0;
			NP.page = decode64(NP.page);
			NP.modified = true;
			return true;
		}
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
		var r = "<!-- "+parse_marker+"::"+snippets.length+" -->";
		snippets.push($1);
		return r;
	});
	if (_wsif_js_sec.comment_js) {
		page = page.replace(reScripts, "<disabled_script$1>$2</disabled_script>");
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
