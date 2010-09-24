// load modes which should be supported by load/save browser bindings
woas.file_mode = {
	UTF8_TEXT:		0,
	ASCII_TEXT:		1,
	DATA_URI:		2,
	BINARY:			3,
	BASE64:			4,
	// will only be available on IE
	UTF16_TEXT:		8
};

// save the currently open WoaS
woas._save_this_file = function(new_data, old_data) {
	var filename = _get_this_filename();

	var r = woas.save_file(filename, this.file_mode.ASCII_TEXT,
		this.DOCTYPE + this.DOC_START + "<"+"script woas_permanent=\"1\" type=\"tex"+"t/javascript\">"
		+ new_data + "\n" + old_data + "<"+"/html>");
	if (r===true)
		woas.log("NOTICE: \""+filename+"\" saved successfully");	// log:1
	else {
		var msg = this.i18n.SAVE_ERROR.sprintf(filename) + "\n\n";
		if (this.use_java_io) {
			// try to understand what went bad with Java
			if (typeof document.applets.TiddlySaver == "undefined")
				msg += this.i18n.NO_TIDDLY_SAVER+" "+TIDDLY_HELP;
			else if (typeof java == "undefined")
				msg += this.i18n.NO_JAVA+" "+TIDDLY_HELP;
			else
				msg += this.i18n.UNSPECIFIED_JAVA_ERROR;
		} else
			msg += woas.i18n.UNSUPPORTED_BROWSER.sprintf(navigator.userAgent);
		this.alert(msg);
	}
	return r;
}

//API1.0: save-file handler
//NOTE: save_mode is not always enforced by browser binding
woas.save_file = function(fileUrl, save_mode, content) {
	var r = null;
	if (!this.use_java_io) {
		r = this.mozillaSaveFile(fileUrl, save_mode, content);
		if((r === null) || (r === false))
			r = this.ieSaveFile(fileUrl, save_mode, content);
		// fallback to try also with Java saving
	} else
		return this.javaSaveFile(fileUrl, save_mode, content);
	if((r === null) || (r === false))
		r = this.javaSaveFile(fileUrl, save_mode, content);
	return r;
};

// get file content in FF3 without .enablePrivilege() (FBNil)
woas.mozillaLoadFileID = function(obj_id, load_mode, suggested_mime) {
	var obj = document.getElementById(obj_id);
	if(!window.Components || !obj.files)
		return null;
	var D=obj.files.item(0);
	if (D === null)
		return false;

	switch (load_mode) {
		case this.file_mode.DATA_URI:
			if (typeof suggested_mime != "string")
				return D.getAsDataURL();
			else // apply mime override
				return D.getAsDataURL().replace(/^data:(\s*)([^;]*)/, "data:$1"+suggested_mime);
			break;
		case this.file_mode.BASE64:
			return D.getAsDataURL().replace(/^data:\s*([^;]*);\s*base64,\s*/, '');
		case this.file_mode.BINARY:
			return D.getAsBinary();
		case this.file_mode.UTF16_TEXT:
			// not available
			this.crash(this.i18n.MODE_NOT_AVAIL.sprintf(this.file_mode.toString(16)));
			return null;
//		default:
	}
	// case UTF8_TEXT:
	// case ASCII_TEXT:
	// return UTF-8 text by default
	return D.getAsText("utf-8");
};

// API1.0: load-file handler
woas.load_file = function(fileUrl, load_mode, mime){
	// parameter consistency check
	if (!load_mode)
		// perhaps should be ASCII?
		load_mode = this.file_mode.UTF8_TEXT;
	// try loading the file without using the path (FF3+)
	// (object id hardcoded here)
	var r = null;
	if (!this.use_java_io) {
		// correctly retrieve fileUrl
		if (fileUrl === null) {
			if (this.browser.firefox3 || this.browser.firefox_new)
				r = this.mozillaLoadFileID("filename_", load_mode, mime);
			else
				fileUrl = this.get_input_file_url();
		}
		if (r === null) // load file using file absolute path
			r = this.mozillaLoadFile(fileUrl, load_mode, mime);
		else return r;
		if(r === false)
			return false;
		// no mozillas here, attempt the IE way
		if (r === null)
			r = this.ieLoadFile(fileUrl, load_mode, mime);
		else return r;
		if (r === false)
			return false;
//		if (r === null)
			// finally attempt to use Java
//			r = this.javaLoadFile(fileUrl, load_mode);
	} else {
		if (fileUrl === null)
			fileUrl = this.get_input_file_url();
		if (fileUrl === false)
			return false;
		r = this.javaLoadFile(fileUrl, load_mode, mime);
	}
	if (r === false)
		return false;
	if (r === null) {
		this.alert('Could not load "'+fileUrl+'"');
		return null;
	}
	// wow, java worked!
	return r;
};

// the following load/save bindings will return:
// * null if they can't do it
// * false if there's an error
// * true if it saved OK
// * string with content if content was read successfully

// save through ActiveX
woas.ieSaveFile = function(filePath, save_mode, content) {
	var s_mode;
	switch (save_mode) {
		case this.file_mode.BINARY:
		case this.file_mode.ASCII_TEXT:
			s_mode = 0; // ASCII
		break;
		default:
			// DATA_URI and UTF8_TEXT modes
			s_mode = -1; // Unicode mode 
		break;
	}
	// first let's see if we can do ActiveX
	var fso;
	try	{
		fso = new ActiveXObject("Scripting.FileSystemObject");
	}
	catch (e) {
		return null;
	}
	try {
		var file = fso.OpenTextFile(filePath, 2, true, s_mode);
		file.Write(content);
		file.Close();
	}
	catch(e) {
		woas.log("ERROR: exception while attempting to save: " + e.toString());	// log:1
		return false;
	}
	return(true);
};

// load through ActiveX
woas.ieLoadFile = function(filePath, load_mode, suggested_mime) {
	var o_mode;
	switch (load_mode) {
		//TODO: check if binary works or not
		//case this.file_mode.BINARY:
		case this.file_mode.DATA_URI:
			// not available
			this.crash(this.i18n.MODE_NOT_AVAIL.sprintf(this.file_mode.toString(16)));
			return null;
		default:	// covers also BASE64
		case this.file_mode.ASCII_TEXT:
			o_mode = 0; // ASCII
		break;
		case this.file_mode.UTF16_TEXT:
			o_mode = -1; // Unicode
		break;
	}
	var fso, content = null;
	try	{
		fso = new ActiveXObject("Scripting.FileSystemObject");
	}
	catch (e) {
		woas.log(e);
		return null;
	}
	try {
		// attempt to open as unicode
		var file = fso.OpenTextFile(filePath,1,false,o_mode);
		content = file.ReadAll();
		file.Close();
	}
	catch(e) {
		woas.log("ERROR: exception while attempting to load\n\n" + e.toString());	// log:1
		return false;
	}
	// return a valid DATA:URI
	if (load_mode == this.file_mode.DATA_URI)
		return this._data_uri_enc(filePath, content, suggested_mime);
	else if (load_mode == this.file_mode.BASE64)
		return this.base64.encode(content);
	// fallback for UTF8_TEXT
	return(content);
};

// save through UniversalXPConnect
woas.mozillaSaveFile = function(filePath, save_mode, content) {
	if (!window.Components)
		return null;
	//FIXME: save_mode is not considered here
	try	{
		netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(filePath);
		if (!file.exists())
			file.create(0, 0664);
		else
			woas.log("NOTICE: file \""+filePath+"\" exists, overwriting");	// log:1
		var out = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
		out.init(file, 0x08 | 0x20 | 0x02, 0700, 0);
		out.write(content, content.length);
		out.flush();
		out.close();
	}
	catch(e) {
		woas.log("NOTICE: exception while attempting to save:\n\n" + e);	// log:1
		return(false);
	}
	return(true);
};

// load through UniversalXPConnect
woas.mozillaLoadFile = function(filePath, load_mode, suggested_mime) {
	// this is available on Mozilla browsers only
	if (!window.Components)
		return null;
	try	{
		netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(filePath);
		if (!file.exists()) {
			woas.log("NOTICE: unexisting file "+filePath);
			return false;
		}
		var inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
		inputStream.init(file, 0x01, 04, 0);
		var sInputStream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
		sInputStream.init(inputStream);
		if ( (load_mode == this.file_mode.UTF8_TEXT) ||
			 (load_mode == this.file_mode.ASCII_TEXT))
			return sInputStream.read(sInputStream.available());
		// this byte-by-byte read allows retrieval of binary files
		var tot=sInputStream.available(), i=tot;
		var rd=[];
		while (i-->=0) {
			var c=sInputStream.read(1);
			rd.push(c.charCodeAt(0));
		}
		if (load_mode == this.file_mode.BINARY)
				return(this.merge_bytes(rd));
		else if (load_mode == this.file_mode.DATA_URI)
			return this._data_uri_enc(filePath, this.merge_bytes(rd), suggested_mime);
		else if (load_mode == this.file_mode.BASE64)
			return this.base64.encode_array(rd);
	}
	catch(e) {
		woas.log("NOTICE: exception while attempting to load:\n\n" + e);	// log:1
	}
	return false;
};

woas._guess_mime = function(filename) {
	var m=filename.match(/\.(\w+)$/);
	if (m===null) m = "";
	else m=m[1].toLowerCase();
	var guess_mime = "image";
	switch (m) {
		case "png":
		case "gif":
		case "bmp":
			guess_mime += "/"+m;
			break;
		case "jpg":
		case "jpeg":
			guess_mime = "image/jpeg";
			break;
	}
	return guess_mime;
};

// creates a DATA:URI from a plain content stream
woas._data_uri_enc = function(filename, ct, guess_mime) {
	if (typeof guess_mime != "string")
		guess_mime = this._guess_mime(filename);
	// perform base64 encoding
	return "data:"+guess_mime+";base64,"+this.base64.encode(ct);
};

//FIXME: save_mode is not enforced
woas.javaSaveFile = function(filePath,save_mode,content) {
	if ((save_mode != this.file_mode.ASCII_TEXT) && (save_mode != this.file_mode.UTF8_TEXT)) {
		woas.log("Only ASCII and UTF8 file modes are supported with Java/TiddlySaver");	//log:1
		return false;
	}
	try {
		if(document.applets.TiddlySaver) {
			var rv = document.applets.TiddlySaver.saveFile(filePath,"UTF-8",content);
			if (typeof rv == "undefined") {
				woas.log("Save failure, this is usually a Java configuration issue");
				return null;
			} else {
				return rv ? true : false;
			}
		}
	} catch(ex) {
		// report but check next method
		woas.log("TiddlySaver applet not available"); //log:1
	}
	// check if no JRE is available
	if (typeof java == "undefined") {
		woas.log("No JRE detected"); //log:1
		return null;
	}
	// try reading the file with java.io
	try {
		var s = new java.io.PrintStream(new java.io.FileOutputStream(filePath));
		s.print(content);
		s.close();
	} catch(ex) {
		woas.log("Failed reading file directly with Java: "+ex.toString());
		return false;
	}
	return true;
};

//FIXME: UTF8_TEXT/BINARY is not enforced here
woas.javaLoadFile = function(filePath, load_mode, suggested_mime) {
	var content = null;
	try {
		if(document.applets.TiddlySaver) {
			content = document.applets.TiddlySaver.loadFile(filePath, "UTF-8");
			if (content === null) {
				woas.log("Load failure, maybe file does not exist? "+filePath); //log:1
				return false;
			}
			// check that it is not an "undefined" string
			if (typeof content == "undefined") {
				woas.log("Load failure, this is usually a Java configuration issue"); //log:1
				return null;
			}
			// convert to string only after checking that it was successfully loaded
			content = String(content);
			if (load_mode == this.file_mode.DATA_URI)
				return this._data_uri_enc(filePath, content, suggested_mime);
			else if (load_mode == this.file_mode.BASE6)
				return this.base64.encode(content);
			return content;
		}
	} catch(ex) {
		// report but check next method
		woas.log("TiddlySaver applet not available"); //log:1
	}
	// check if no JRE is available
	if (typeof java == "undefined") {
		woas.log("No JRE detected"); //log:1
		return null;
	}
	var a_content = [];
	try {
		var r = new java.io.BufferedReader(new java.io.FileReader(filePath));
		var line;
		while((line = r.readLine()) !== null)
			a_content.push(new String(line));
		r.close();
	} catch(ex) {
		woas.log("Exception in javaLoadFile(\""+filePath+"\"): "+ex);
		return false;
	}
	// re-normalize input
	content = a_content.join("\n");
	if (load_mode == this.file_mode.DATA_URI)
		return this._data_uri_enc(filePath, content, suggested_mime);
	else if (load_mode == this.file_mode.BASE64)
		return this.base64.encode(content);
	return content;
};

function printout_arr(arr, split_lines) {

	function elem_print(e) {
		return "'" + woas.js_encode(e, split_lines) + "'";
	}

	var s = "";
	for(var i=0;i < arr.length-1;i++) {
		s += elem_print(arr[i]) + ",\n";
	}
	if (arr.length>1)
		s += elem_print(arr[arr.length-1]) + "\n";
	return s;
}

function printout_mixed_arr(arr, split_lines, attrs) {

	function elem_print(e, attr) {
		if (attr & 2) {
			return "[" + printout_num_arr(e) + "]";
		}
		return "'" + woas.js_encode(e, split_lines) + "'";
	}

	var s = "";
	for(var i=0;i < arr.length-1;i++) {
		s += elem_print(arr[i], attrs[i]) + ",\n";
	}
	if (arr.length>1)
		s += elem_print(arr[arr.length-1], attrs[arr.length-1]) + "\n";
	return s;
}

// used to print out encrypted page bytes and attributes
function printout_num_arr(arr) {
	var s = "",it=arr.length-1;
	for(var i=0;i<it;i++) {
		if (arr[i]>=1000)
			s += "0x"+arr[i].toString(16) + ",";
		else
			s+=arr[i].toString() + ",";
	}
	// do not write comma on last element, workaround due to IE6 not recognizing it
	if (it>0) {
		if (arr[it]>=1000)
			s += "0x"+arr[it].toString(16);
		else
			s+=arr[it].toString();
	}

	return s;
}

function printout_fixed(elem, n) {
	var s = (elem+",").repeat(n-1);
	// do not write comma on last element, workaround due to IE6 not recognizing it
	if (n>1)
		s += elem;
	return s;
}

// save full WoaS to file
woas._save_to_file = function(full) {
	this.progress_init("Saving to file");

	// force full mode if WSIF datasource mode changed since last time loading/saving
	var ds_changed = (this.config.wsif_ds.length !== this._old_wsif_ds_len);
	
	// increase the marker only when performing full save
	var new_marker = ((full | ds_changed) && !this.config.wsif_ds.length) ? _inc_marker(__marker) : __marker;
	
	// setup the page to be opened on next start
	var safe_current;
	if (this.config.nav_history) {
		if (!this.page_exists(current))
			safe_current = this.config.main_page;
		else safe_current = current;
	} else
		safe_current = this.config.main_page;
	
	// output the javascript header and configuration flags
	var computed_js = "\n/* <![CDATA[ */\n\n/* "+new_marker+"-START */\n\nvar woas = {\"version\": \""+this.version+
	"\"};\n\nvar __marker = \""+new_marker+"\";\n\nwoas[\"config\"] = {";
	for (var param in this.config) {
		computed_js += "\n\""+param+"\":";
		switch(typeof(this.config[param])) {
			case "boolean":
				computed_js += (this.config[param] ? "true" : "false")+",";
			break;
			case "string":
				computed_js += "'"+this.js_encode(this.config[param])+"',";
			break;
			default: // for numbers
				computed_js += this.config[param]+",";
			break;
		}
	}
	computed_js = computed_js.substr(0,computed_js.length-1);
	computed_js += "};\n";
	
	computed_js += "\nvar current = '" + this.js_encode(safe_current)+"';\n\n";
	
	computed_js += "var backstack = [\n" + printout_arr(this.config.nav_history ? backstack : [], false) + "];\n\n";
	
	// in WSIF datasource mode we will save empty arrays
	if (this.config.wsif_ds.length !== 0)
		computed_js += "var page_titles = [\n];\n\n";
	else
		computed_js += "var page_titles = [\n" + printout_arr(page_titles, false) + "];\n\n";
	
	computed_js += "/* " + new_marker + "-DATA */\n";

	if (full || ds_changed) {
		this._old_wsif_ds_len = this.config.wsif_ds.length;
		if (this.config.wsif_ds.length) {
			// everything empty when the javascript layer is not used
			computed_js += "var page_attrs = [];\n\n";
			computed_js += "var page_mts = [];\n\n";
			computed_js += "var pages = [\n];\n\n";
		} else {
			computed_js += "var page_attrs = [" + printout_num_arr(page_attrs) + "];\n\n";
			computed_js += "var page_mts = [" + (this.config.store_mts ? printout_num_arr(page_mts) : "0, ".repeat(page_mts.length-1)+"0") + "];\n\n";
			computed_js += "var pages = [\n" + printout_mixed_arr(pages, this.config.allow_diff, page_attrs) + "];\n\n";
		}
		computed_js += "/* " + new_marker + "-END */\n";
	}

	// cleanup the DOM before saving
	var bak_ed = d$("woas_editor").value,
		bak_tx = this.getHTMLDiv(d$("woas_wiki_area")),
		bak_mn = this.getHTMLDiv(d$("woas_menu_area")),
		bak_mts = this.getHTMLDiv(d$("woas_mts")),
		bak_mts_shown = d$.is_visible("woas_mts"),
		bak_wait_text = this.getHTML(d$("woas_wait_text")),
		bak_debug = d$("woas_debug_log").value,
	// clear titles and css as well as they will be set on load.
		bak_title = this.getHTMLDiv(d$("woas_title"));

	if (bak_mts_shown)
		d$.hide("woas_mts");
	d$("woas_editor").value = "";
	this.setHTMLDiv(d$("woas_wiki_area"), "");
	this.setHTMLDiv(d$("woas_menu_area"), "");
	this.setHTMLDiv(d$("woas_mts"), "");
	this.setHTMLDiv(d$("woas_title"), "");
	d$("woas_debug_log").value = "";

	// set the loading message
	this.setHTML(d$("woas_wait_text"), this.i18n.LOADING);
	// temporarily display such message
	d$.show("loading_overlay");
	var bak_cursor = document.body.style.cursor;
	document.body.style.cursor = "auto";

	var data = this._extract_src_data(__marker, document.documentElement.innerHTML, full | ds_changed, safe_current);
	
	// data is ready, now the actual save process begins
	var r=false;
	d$.hide("loading_overlay");
	this.setHTML(d$("woas_wait_text"), bak_wait_text);
	document.body.style.cursor = bak_cursor;

	//DEBUG check
	if (data.length === 0) {
		this.crash("Could not retrieve original DOM data!");
	} else {
	
//	if (!this.config.server_mode || (was_local && this.config.server_mode)) {
	if (!this._server_mode)
		r = this._save_this_file(computed_js, data);
//		was_local = false;
//	}

	// save was successful - trigger some events
	if (r) {
		this.after_config_saved();
		if (full)
			this.after_pages_saved();
	}
	} //DEBUG check

	d$("woas_editor").value = bak_ed;
	this.setHTMLDiv(d$("woas_wiki_area"), bak_tx);
	this.setHTMLDiv(d$("woas_menu_area"), bak_mn);
	this.setHTMLDiv(d$("woas_mts"), bak_mts);
	if (bak_mts_shown)
		d$.show("woas_mts");
	d$("woas_debug_log").value = bak_debug;
	this.setHTMLDiv(d$("woas_title"), bak_title);
	
	//TODO: re-run after parsing hooks
	// would fix issues with import page for example
	
	this.progress_finish();
	
	return r;
};

function reXHTMLFix_hook(str, tag) {
	var l=str.length;
	if (str.charAt(l-1)!=='/')
		str = str.substr(0, l-1)+" />";
	return str;
}
var reXHTMLFix = /<(img|hr|br|input|meta)[^>]*>/gi;

var reHeadTagEnd = new RegExp("<\\/"+"head[^>]*>", "ig");
	reHeadTagStart = new RegExp("<"+"head[^>]*>", "ig"),
	reTagStart = /<(\w+)([^>]*)>/g,
	reTagEnd = /<\/(\w+)[^>]*>/g;

woas._extract_src_data = function(marker, source, full, current_page, data_only) {
	var e_offset, s_offset;
	// find the start marker for safety checking
	s_offset = source.indexOf("/* "+marker+ "-START */");
	if (s_offset === -1) {
		this.alert(this.i18n.ERR_MARKER.sprintf("START"));
		return false;
	}			
	// find the end marker, necessary to make some DOM/XHTML fixes
	e_offset = source.indexOf("/* "+marker+ "-END */", s_offset);
	if (e_offset === -1) {
		this.alert(this.i18n.ERR_MARKER.sprintf("END"));
		return false;
	}
	// properly update offset (+2 is for newlines)
	e_offset += 3 + marker.length + 7 + 2;
	
	// used during import
	if (full && data_only) {
		return source.substring(s_offset, e_offset);
	}

	reHeadTagStart.lastIndex = 0;
	var head_start, head_end,
		m = reHeadTagStart.exec(source);
	if (m !== null)
		head_start = m.index+m[0].length
	else {
		this.crash("Cannot find head start tag");
		return false;
	}
	// search for head end tag starting at data end offset
	reHeadTagEnd.lastIndex = e_offset;
	m = reHeadTagEnd.exec(source);
	if (m !== null)
		head_end = m.index + m[0].length;
	else {
		this.crash("Cannot find head end tag");
		return false;
	}
	
	// filter out the unimportant tags from head
	// build a list of replacements with offsets
	
	// first take away the head
	var needle, m2, l_attrs, the_head = source.substring(0, head_end),
		splicings = [], tag_end,
		rest_of_source = source.substring(head_end);
	// reset big string
	source = "";
	// skip non-head content
	reTagStart.lastIndex = head_start;
	
	m = reTagStart.exec(the_head);
	while (m !== null) {
		tag = m[1].toLowerCase();
		var broken=false;
		switch (tag) {
			case "script":
			case "style":
			case "title":
				reTagEnd.lastIndex = m.index + m[0].length;
				do {
					m2 = reTagEnd.exec(the_head);
					if (m2 === null) {
						woas.log("found "+m[1]+" without closing tag");
						// continue to check for permanent attribute
						broken = true;
						break;
					}
					close_tag = m2[1].toLowerCase();
				} while (close_tag !== tag);
				// fallback wanted to set tag end like if it was a single tag
				if (!broken) {
					tag_end = tag_end = m2.index+m2[0].length;
					break;
				}
			case "meta":
				tag_end = m.index+m[0].length;
				break;
			default:
//				woas.log("Unknown tag in head: "+tag);
				// continue to check for permanent attribute
				tag_end = m.index+m[0].length;
				broken = true;
			break;
		}
		
		l_attrs = m[2].toLowerCase();
		// this was marked as permanent tag
		var was_replaced = false;
		if (l_attrs.indexOf("woas_permanent=")!==-1) {
			if (!broken) {
			if (tag === "style") {
				was_replaced = true;
				if (l_attrs.indexOf("woas_core_style=")!==-1) {
					woas.log("Replacing CSS");
					needle = m[0]+woas.get_text("WoaS::CSS::Boot")+m2[0];
				} // else leave as-is
			} else if (tag === "title") {
				woas.log("Replacing title");
				needle = m[0]+woas.xhtml_encode(current_page)+m2[0];
				was_replaced = true;
			}
			}
			// will leave tag untouched
		} else {
			woas.log("Removing tag "+tag);
			needle = "";
			was_replaced = true;
		}
		if (was_replaced)
			// add this splicing
			splicings.push( { start: m.index, end: tag_end, needle: needle } );
		reTagStart.lastIndex = tag_end;
		m = reTagStart.exec(the_head);
	}
	
	// rebuild the source by using splicings
	if (splicings.length) {
		var prev_ofs = 0;
		for(var i=0;i < splicings.length;++i) {
			source += the_head.substring(prev_ofs, splicings[i].start) + splicings[i].needle;
			prev_ofs = splicings[i].end;
		} splicings = null;

		// XHTML hotfixes (FF doesn't either save correctly)
		source += the_head.substr(prev_ofs); the_head = null;
		
		// re-calculate offsets
		
		// find the start marker for safety checking
		s_offset = source.indexOf("/* "+marker+ "-START */");
		if (s_offset === -1) {
			this.alert(this.i18n.ERR_MARKER.sprintf("START"));
			return false;
		}			
		// find the end marker, necessary to make some DOM/XHTML fixes
		e_offset = source.indexOf("/* "+marker+ "-END */", s_offset);
		if (e_offset === -1) {
			this.alert(this.i18n.ERR_MARKER.sprintf("END"));
			return false;
		}
		// properly update offset (+2 is for newlines)
		e_offset += 3 + marker.length + 7 + 2;

		source += rest_of_source.replace(reXHTMLFix, reXHTMLFix_hook);
		rest_of_source = null;
	} else {
		// XHTML hotfixes (FF doesn't either save correctly)
		//TODO: check if FF3 has still this behaviour
		
		source = the_head + rest_of_source.replace(reXHTMLFix, reXHTMLFix_hook);
		the_head = rest_of_source = null;
	}
	
	// remove the tail (if any)
	var tail_end_mark = "<"+"!-- "+marker+"-TAIL-END -"+"->",
			tail_st_mark = "<"+"!-- "+marker+"-TAIL-START --"+">",
			tail_start = source.indexOf(tail_st_mark, e_offset);
	if (tail_start !== -1) {
		var tail_end = source.indexOf(tail_end_mark, tail_start);
		if (tail_end === -1)
			woas.log("Cannot find tail end!"); //log:1
		else {
			// remove the tail content (but not the tail itself)
			source =	source.substring(0, tail_start + tail_st_mark.length)+
						source.substring(tail_end+tail_end_mark.length);
			//TODO: replace textarea with a standard one
		}
	}
	
	// remove the custom keys defined
	var ck_block = new RegExp('<'+'div\\s+id="?woas_custom_accesskeys"?\\s*>(.*?)<'+'/div>', 'gi');
	source = source.replace(ck_block, '<'+'div id="woas_custom_accesskeys">&'+'nbsp;<'+'/div>');

	if (!full) {
		e_offset = source.indexOf("/* "+marker+ "-DATA */", s_offset);
		if (e_offset === -1) {
			this.alert(this.i18n.ERR_MARKER.sprintf("DATA"));
			return false;
		}
		e_offset += 3 + marker.length + 8;
	}
	return source.substring(e_offset);
}

// increment the save-counter portion of the marker
var reMarker = /([^\-]*)\-(\d{7,7})$/;
function _inc_marker(old_marker) {
	var m = old_marker.match(reMarker);
	if (m===null) {
		return _random_string(10)+"-0000001";
	}
	var n = new Number(m[2].replace(/^0+/, '')) + 1;
	n = n.toString();
	// marker part + 0-padded save count number
	return m[1]+"-"+String("0").repeat(7-n.length)+n;
}

// load URL via XHR
woas.remote_load = function(url) {
	var HttpReq = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
	HttpReq.open('GET', url, false);
	HttpReq.setRequestHeader('Content-Type', 'text/plain')
	HttpReq.send(null);
	return HttpReq.responseText;
}
