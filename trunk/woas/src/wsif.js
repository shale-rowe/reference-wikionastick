
// a class for some general WSIF operations
woas["wsif" ] = {version: "1.0.0"};

woas["wsif"]["header"] = function(header_name, value) {
	return header_name+": "+value+"\n";
}

woas["wsif"]["inline"] = function(boundary, content) {
	return "--"+boundary+"\n"+content+"\n--"+boundary+"\n";
}

// native WSIF-saving mode used during development - use with CARE!
woas["_native_wsif"] = true;

// default behaviour:
// - wiki pages go inline (utf-8), no container encoding
// - embedded files/images go outside as blobs
// - encrypted pages go inline in base64
woas["export_wiki_wsif"] = function () {
	// export settings object
	var wsif_exp = {};
	try {
		wsif_exp["path"] = $("woas_ep_wsif").value;
		wsif_exp["author"] = this.trim($("woas_ep_author").value);
		wsif_exp["single"] = $("woas_cb_single_wsif").checked ? true : false;
		wsif_exp["inline"] = $("woas_cb_inline_wsif").checked ? true : false;
	} catch (e) { this.crash(e); return false; }
	
	// block interaction for a while
	$.show("loading_overlay");
	$("loading_overlay").focus();
	
	// the number of blobs which we have already created
	var blob_counter = 0;
	
	// prepare the extra headers
	var extra = this.wsif.header('wsif.version', this.wsif.version);
	extra += this.wsif.header('woas.version', this.version);
	if (wsif_exp.author.length)
		extra += this.wsif.header('woas.author', wsif_exp.author);

	// boundary used for inline attachments
	var full_wsif = "", boundary = "";

	var l=page_titles.length, done = 0;
	for (var pi=0;pi<l;pi++) {
		// do skip physical special pages
		if (!this._native_wsif) {
			if (page_titles[pi].match(/^Special::/)) continue;
		}
		// the attributes prefix
		var pfx = "woas.page"+pi.toString()+".";
		var record = this.wsif.header(pfx+"title", page_titles[pi])+
					this.wsif.header(pfx+"attributes", page_attrs[pi])+
					this.wsif.header(pfx+"last_modified", page_mts[pi]),
					ct = null;
		
		// normalize the page content, set encoding&disposition
		var encoding = "8bit/plain", disposition = "inline";
		if (this.is__encrypted(pi)) {
			ct = encode64_array(pages[pi]);
			encoding = "8bit/base64";
		} else {
			ct = pages[pi];
			if (this.is__embedded(pi)) {
				// if not forced to do them inline, convert for export
				if (!wsif_exp.inline) {
					disposition = "external";
					encoding = "8bit/plain";
					// decode the base64-encoded data
					if (this.is__image(pi))
						ct = decode64(ct.replace(/^data:\s*[^;]*;\s*base64,\s*/, ''));
					else // no data:uri for files
						ct = decode64(ct);
				} else {
					encoding = "8bit/base64";
					if (this.is__image(pi)) {
						var m = ct.match(/^data:\s*([^;]*);\s*base64,\s*/);
						if (m == null)
							alert(ct);
						record += this.wsif.header(pfx+"mime", m[1]);
						// remove the matched part
						ct = ct.substr(m[0].length);
					}
				}
			}
		}
		// update record
		record += this.wsif.header(pfx+"length", ct.length);
		record += this.wsif.header(pfx+"encoding", encoding);
		record += this.wsif.header(pfx+"disposition", disposition);
		// note: when disposition is inline, encoding cannot be 8bit/plain for embedded/encrypted files
		if (disposition == "inline") {
			// create the inline page
			boundary = _generate_random_boundary(boundary, ct);
			record += this.wsif.header(pfx+"boundary", boundary);
			// assign the mime/type
			// add a newline for spacing purposes
			record += "\n";
			// add the inline content
			record += this.wsif.inline(boundary, ct); ct = null;
		} else {
			// create the blob filename
			var blob_fn = "blob" + (++blob_counter).toString()+
						_file_ext(page_titles[pi]);
			// specify path to external filename
			record += this.wsif.header(pfx+"disposition.filename", blob_fn);
			//TODO: some error checking?
			this.save_file(wsif_exp.path + blob_fn,
							(encoding == "8bit/plain") ?
							this.file_mode.BINARY : this.file_mode.UTF8_TEXT, ct);
		}
		// the page record is now ready, proceed to save
		if (wsif_exp.single) {// append to main page record
			full_wsif += record;
			++done;
		} else {
			if (this.save_file(wsif_exp.path+pi.toString()+".wsif",
								this.file_mode.UTF8_TEXT,
								extra + "\n" + record))
				++done;
		}
		// reset the record
		record = "";
	} // foreach page
	if (wsif_exp.single) {
		// add the total pages number
		extra += this.wsif.header('woas.pages', done);
		// output the full single WSIF file now
		if (!this.save_file(wsif_exp.path+"index.wsif",
							this.file_mode.UTF8_TEXT,
							extra + "\n" + full_wsif))
			done = 0;
	}

	$.hide("loading_overlay");
	this.alert(this.i18n.EXPORT_OK.sprintf(done));
	return true;

}

function _file_ext(fn) {
	var m=fn.match(/\.(\w+)$/);
	if (m == null) return "";
	return "."+m[1];
}

function _generate_random_boundary(old_boundary, text) {
	var b = old_boundary;
	if (!b.length)
		b = _random_string(20);
	while (text.indexOf(b) != -1) {
		b = _random_string(20);
	}
	return b;
}
