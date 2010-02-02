
// native WSIF-saving mode used during development - use with CARE!
// set to null to disable
// empty string will save index.wsif in same directory of WoaS XHTML file
//woas["_native_wsif"] = "";
woas["_native_wsif"] = null;

// a class for some general WSIF operations
woas["wsif" ] = {version: "1.0.0"};

woas["wsif"]["header"] = function(header_name, value) {
	return header_name+": "+value+"\n";
}

woas["wsif"]["inline"] = function(boundary, content) {
	return "\n--"+boundary+"\n"+content+"\n--"+boundary+"\n";
}

// default behaviour:
// - wiki pages go inline (utf-8), no container encoding
// - embedded files/images go outside as blobs
// - encrypted pages go inline in base64

woas["_native_wsif_save"] = function(path, single_wsif, inline_wsif, author,
							save_all, plist) {
	// the number of blobs which we have already created
	var blob_counter = 0;
	
	// prepare the extra headers
	var extra = this.wsif.header('wsif.version', this.wsif.version);
	extra += this.wsif.header('woas.version', this.version);
	if (author.length)
		extra += this.wsif.header('woas.author', author);

	// boundary used for inline attachments
	var full_wsif = "", boundary = __marker;
	// use the 1st part of the global marker
	var p = boundary.indexOf("-");
	if (p !== -1)
		boundary = boundary.substr(0,p);

	var l, done = 0, full_save;
	if (typeof plist == "undefined") {
		full_save = true;
		l = page_titles.length;
	} else {
		l = plist.length;
		full_save = false;
	}
	// the attributes prefix, we do not use the page index here for better versioning
	var pfx = "woas.page.";
	var pi;
	for (var ipi=0;ipi < l;++ipi) {
		if (full_save)
			pi = ipi;
		else
			pi = plist[ipi];
		// do skip physical special pages
		if (!save_all) {
			if (page_titles[pi].match(/^Special::/)) continue;
		}
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
				if (!inline_wsif) {
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
		// update the index (if needed)
		if (!single_wsif && full_save) {
			full_wsif += this.wsif.header(pfx+"title", page_titles[pi]);
			// a new mime type
			full_wsif += this.wsif.header(pfx+"encoding", "text/wsif");
			full_wsif += this.wsif.header(pfx+"disposition", "external");
			// add reference to the external WSIF file
			full_wsif += this.wsif.header(pfx+"disposition.filename", pi.toString()+".wsif")+
							"\n";
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
			// add the inline content
			record += this.wsif.inline(boundary, ct); ct = null;
		} else {
			// create the blob filename
			var blob_fn = "blob" + (++blob_counter).toString()+
						_file_ext(page_titles[pi]);
			// specify path to external filename
			record += this.wsif.header(pfx+"disposition.filename", blob_fn);
			//TODO: some error checking?
			this.save_file(path + blob_fn,
							(encoding == "8bit/plain") ?
							this.file_mode.BINARY : this.file_mode.UTF8_TEXT, ct);
		}
		// the page record is now ready, proceed to save
		if (single_wsif) {// append to main page record
			full_wsif += record;
			++done;
		} else { // save each page separately
			if (this.save_file(path+pi.toString()+".wsif",
								this.file_mode.UTF8_TEXT,
								extra + "\n" + record))
				++done;
		}
		// reset the record
		record = "";
	} // foreach page
	// add the total pages number
	if (full_save || single_wsif)
		extra += this.wsif.header('woas.pages', done);
	else
		extra += this.wsif.header('woas.pages', page_titles.length);
	// build (artificially) an index of all pages
	if (!full_save && !single_wsif) {
		for (var pi=0,pl=page_titles.length;pi<pl;++pi) {
			full_wsif += this.wsif.header(pfx+"title", page_titles[pi]);
			// a new mime type
			full_wsif += this.wsif.header(pfx+"encoding", "text/wsif");
			full_wsif += this.wsif.header(pfx+"disposition", "external");
			// add reference to the external WSIF file
			full_wsif += this.wsif.header(pfx+"disposition.filename", pi.toString()+".wsif")+
							"\n";
		}
	}
	// output the index WSIF file now
	if (!this.save_file(path+"index.wsif",
						this.file_mode.UTF8_TEXT,
						extra + "\n" + full_wsif)) {
		if (single_wsif)
			done = 0;
	} // we do not increment page counter when saving index.wsif
	return done;
}

function _file_ext(fn) {
	var m=fn.match(/\.(\w+)$/);
	if (m == null) return "";
	return "."+m[1];
}

function _generate_random_boundary(old_boundary, text) {
	var b = old_boundary;
	if (!b.length)
		b = _random_string(10);
	while (text.indexOf(b) != -1) {
		b = _random_string(10);
	}
	return b;
}

woas["_native_load"] = function() {
	return false;
}

woas["_native_wsif_load"] = function(path, overwrite) {
	var ct = this.load_file(path, this.file_mode.UTF8_TEXT);
	if (typeof ct != "String") {
		return false;
	}
	var pfx = "\nwoas.page.", pfx_len = pfx.length;
	// start looping to find each page
	var p = ct.indexOf(pfx), fail = false;
	var title, attrs, last_mod, len, encoding, disposition, boundary;
	while (p != -1) {
		// remove prefix
		sep = ct.indexOf(":", p+pfx_len);
		if (sep == -1) {
			fail = true;
			break;
		}
		// get attribute name
		var sep, vsep, s, v;
		s = ct.substring(p+pfx_len, sep);
		// get value
		vsep = ct.indexOf("\n", sep+1);
		if (vsep == -1) {
			fail = true;
			break;
		}
		v = ct.substring(sep+1, vsep);
		// update pointer
		p = vsep+1;
		switch (s) {
			case "title":
				// we have just jumped over a page definition
				if (title !== null) {
					p = this._native_page_def(ct,p,title,attrs,last_mod,len,encoding,
											disposition,boundary);
					title = attrs = last_mod = encoding = len =
						 boundary = disposition = null;
					if (p == -1) {
						fail = true;
						break;
					}
				}
				title = v;
			break;
			case "attributes":
				attrs = Number(v);
			break;
			case "last_modified":
				last_mod = Number(v);
			break;
			case "length":
				len = Number(v);
			break;
			case "encoding":
				encoding = v;
			break;
			case "disposition":
				disposition = v;
			break;
			case "boundary":
				boundary = v;
			break;
			default:
				log("Unknown WSIF header: "+s);
		} // end switch(s)
		// set pointer to next entry
		p = ct.indexOf(pfx, p);
	}
	// process the last page (if any)
	if (title != null)
		this._native_page_def(ct,p,title,attrs,last_mod,len,encoding,
											disposition,boundary)
	return !fail;
}

woas["_native_page_def"] = function(ct,p,title,attrs,last_mod,len,encoding,
											disposition,boundary) {
	// craft the exact boundary match string
	boundary = "\n--"+boundary+"\n";
	// locate start and ending boundaries
	var bpos_s = ct.indexOf(boundary, p);
	if (bpos_s == -1) {
		log("Failed to find start boundary "+boundary+" for page "+title); //log:1
		return -1;
	}
	var bpos_e = ct.indexOf(boundary, bpos_s+boundary.length);
	if (bpos_e == -1) {
		log("Failed to find end boundary "+boundary+" for page "+title); //log:1
		return -1;
	}
	// retrieve full page content
	var page = ct.substring(bpos_s, bpos_e);
	alert(page);
	return -1;
	// return updated offset
	return bpos_e+boundary.length;
}
