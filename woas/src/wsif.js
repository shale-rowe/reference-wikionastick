
// a class for some general WSIF operations
woas.wsif = {
	version: "1.3.0",
	DEFAULT_INDEX: "index.wsif",
	emsg: null,
	imported_page: false,
	expected_pages: null,
	system_pages: 0,
	global_progress: 0
};

woas.wsif.header = function(header_name, value) {
	return header_name+": "+value+"\n";
};

woas.wsif.inline = function(boundary, content) {
	return "\n--"+boundary+"\n"+content+"\n--"+boundary+"\n";
};

var reMimeMatch = /^data:\s*([^;]*);\s*base64,\s*/;

// default behavior:
// - wiki pages go inline (utf-8), no container encoding
// - embedded files/images go outside as blobs
// - encrypted pages go inline in base64
woas._native_wsif_save = function(path, src_fname, locking, single_wsif, inline_wsif, author,
							save_all, plist) {
	function _generate_random_boundary(old_boundary, text) {
		var b = old_boundary;
		if (!b.length)
			b = _random_string(10);
		while (text.indexOf(b) != -1) {
			b = _random_string(10);
		}
		return b;
	}

	this.progress_init("WSIF save");
	
	// prepare the extra headers
	var extra = this.wsif.header('wsif.version', this.wsif.version);
	extra += this.wsif.header('wsif.generator', 'woas');
	extra += this.wsif.header('woas.version', this.version);
	if (author.length)
		extra += this.wsif.header('woas.author', author);

	// boundary used for inline attachments
	var full_wsif = "", boundary = __marker,
		p = boundary.indexOf("-"),
		l, done = 0, full_save;
	// use the 1st part of the global marker
	if (p !== -1)
		boundary = boundary.substr(0,p);

	if (typeof plist == "undefined") {
		full_save = true;
		l = page_titles.length;
	} else {
		l = plist.length;
		full_save = false;
	}
	// save count of total pages which need to be exported
	this.wsif.expected_pages = l;
	// the attributes prefix, we do not use the page index here for better versioning
	var pfx = "woas.page.",
		pi, pl;
	for (var ipi=0;ipi < l;++ipi) {
		if (full_save)
			pi = ipi;
		else
			pi = plist[ipi];
		// do skip physical special pages
		if (!save_all) {
			if (page_titles[pi].match(/^Special::/)) continue;
			if (this.static_pages2.indexOf(page_titles[pi]) !== -1) continue;
			if (page_titles[pi].match(/^WoaS::Help::/)) continue;
		}
		var record = this.wsif.header(pfx+"title", this.ecma_encode(page_titles[pi]))+
					this.wsif.header(pfx+"attributes", page_attrs[pi]);
		// specify timestamp only if not magic
		if (this.config.store_mts && (page_mts[pi] !== 0))
			record += this.wsif.header(pfx+"last_modified", page_mts[pi]);
		var ct = null, orig_len = null;
		
		// normalize the page content, set encoding&disposition
		var encoding = null, mime = null, disposition = "inline";
		if (this.is__encrypted(pi)) {
			ct = encode64_array(pages[pi]);
			encoding = "8bit/base64";
			// special header used for encrypted pages
			orig_len = pages[pi].length;
		} else {
			ct = pages[pi];
			if (this.is__embedded(pi)) {
				// if not forced to do them inline, convert for export
				var m;
				if (!inline_wsif) {
					disposition = "external";
					encoding = "8bit/plain";
					// decode the base64-encoded data
					if (this.is__image(pi)) {
						m = ct.match(reMimeMatch);
						record += this.wsif.header(pfx+"mime", m[1]);
						// remove the matched part
						ct = decode64(ct.substr(m[0].length));
					} else // no data:uri for files
						ct = decode64(ct);
				} else {
					encoding = "8bit/base64";
					if (this.is__image(pi)) {
						m = ct.match(reMimeMatch);
						if (m === null) {
							this.crash(page_titles[pi]+" is not a valid image!"+ct);							
							continue;
						} else {
							mime = m[1];
							// remove the matched part
							ct = ct.substr(m[0].length);
							m = null;
						}
						record += this.wsif.header(pfx+"mime", mime);
					}
				}
			} else { // normal wiki pages
				// check if ECMA encoding is necessary
				if (this.needs_ecma_encoding(ct)) {
					ct = this.ecma_encode(ct);
					encoding = "ecma/plain";
				} else
					encoding = "8bit/plain";
			}
		}
		//DEBUG check
		if (encoding === null) {
			this.crash("Encoding for page "+page_titles[pi]+" is set to null!");
			continue;
		}
		// update the index (if needed)
		if (!single_wsif && full_save) {
			full_wsif += this.wsif.header(pfx+"title", this.ecma_encode(page_titles[pi]));
			// a new mime type
			full_wsif += this.wsif.header(pfx+"encoding", "text/wsif");
			full_wsif += this.wsif.header(pfx+"disposition", "external");
			// add reference to the external WSIF file
			full_wsif += this.wsif.header(pfx+"disposition.filename", pi.toString()+".wsif")+
							"\n";
		}
		// update record
		if (!this.config.allow_diff)
			record += this.wsif.header(pfx+"length", ct.length);
		record += this.wsif.header(pfx+"encoding", encoding);
		record += this.wsif.header(pfx+"disposition", disposition);
		// note: when disposition is inline, encoding cannot be 8bit/plain for embedded/encrypted files
		if (disposition == "inline") {
			// output the original length header (if available)
			if (orig_len !== null)
				record += this.wsif.header(pfx+"original_length", orig_len);
			// create the inline page
			boundary = _generate_random_boundary(boundary, ct);
			record += this.wsif.header(pfx+"boundary", boundary);
			// add the inline content
			record += this.wsif.inline(boundary, ct); ct = null;
		} else {
			// create the blob filename
			var blob_fn = "blob" + pi.toString() + woas._file_ext(page_titles[pi]);
			// specify path to external filename
			record += this.wsif.header(pfx+"disposition.filename", blob_fn)+"\n";
			// export the blob
			if (!this.save_file(path + blob_fn,
							(encoding === "8bit/plain") ?
							this.file_mode.BINARY : this.file_mode.ASCII_TEXT, ct))
				log("Could not save "+blob_fn);	//log:1
			// release any lock held previously
			if (locking)
				this.locks.release(path+blob_fn);
		}
		// the page record is now ready, proceed to save
		if (single_wsif) {// append to main page record
			full_wsif += record;
			++done;
		} else { // save each page separately
			if (this.save_file(path+pi.toString()+".wsif",
								this.file_mode.ASCII_TEXT,
								// also add the pages counter (single)
								extra + (this.config.allow_diff ? "" : this.wsif.header("woas.pages", 1)) +
								"\n" + record))
				++done;
		}
		this.progress_status(done/l);
		// reset the record
		record = "";
	} // foreach page
	// add the total pages number
	if (!this.config.allow_diff) {
		if (full_save || single_wsif)
			extra += this.wsif.header('woas.pages', done);
		else
			extra += this.wsif.header('woas.pages', page_titles.length);
	}
	// build (artificially) an index of all pages
	if (!full_save && !single_wsif) {
		for (pi=0,pl=page_titles.length;pi<pl;++pi) {
			full_wsif += this.wsif.header(pfx+"title", this.ecma_encode(page_titles[pi]));
			// a new mime type
			full_wsif += this.wsif.header(pfx+"encoding", "text/wsif");
			full_wsif += this.wsif.header(pfx+"disposition", "external");
			// add reference to the external WSIF file
			full_wsif += this.wsif.header(pfx+"disposition.filename", pi.toString()+".wsif")+
							"\n";
		}
	}
	// output the index WSIF file now
	if (!this.save_file(path+src_fname,
						this.file_mode.ASCII_TEXT,
						extra + "\n" + full_wsif)) {
		if (single_wsif)
			done = 0;
	} // we do not increment page counter when saving index.wsif
	
	// release any lock held previously
	if (locking)
		this.locks.release(path+src_fname);
	
	this.progress_finish();
	return done;
};

woas._wsif_ds_load = function(subpath, locking) {
	// we reset the arrays before loading the real data from index.wsif
	pages = [];
	page_attrs = [];
	page_titles = [];
	page_mts = [];
	// get the data
	var path = woas.ROOT_DIRECTORY+subpath;
	return this._native_wsif_load(path, locking, false, false);
};

woas._native_wsif_load = function(path, locking, overwrite, and_save, recursing, pre_import_hook) {
	if (!recursing) {
		this.wsif.emsg = null;
		this.progress_init("Initializing WSIF import");
	}
	var ct;
	// allow remote loading when running in native WSIF mode
	if (this._server_mode && (this.config.wsif_ds.length !== 0))
		ct = this.remote_load(path)
	else
		ct = this.load_file(path, this.file_mode.ASCII_TEXT);
	if (typeof ct != "string") {
		if (!recursing)
			this.progress_finish();
		if (ct === false)
			this.alert(this.i18n.LOAD_ERR);
		return false;
	}
	// reset when not recursing
	if (!recursing) {
		this.wsif.expected_pages = null;
		this.wsif.emsg = this.i18n.NO_ERROR;
		this.wsif.imported_page = false;
		this.wsif.system_pages = 0;
		this.wsif.global_progress = 0;
	}
	// the imported pages
	var imported = [];
	var pfx = "\nwoas.page.", pfx_len = pfx.length;
	// start looping to find each page
	var p = ct.indexOf(pfx), fail = false;
	// this is used to mark end-of-block
	var previous_h = null;
	// too early failure
	if (p == -1)
		this.wsif_error("Invalid WSIF file");
	else { // OK, first page was located, now get some general WSIF info
		var wsif_v = ct.substring(0,p).match(/^wsif\.version:\s+(.*)$/m);
		if (wsif_v === null) {
			this.wsif_error(this.i18n.WSIF_NO_VER);
			p = -1;
			fail = true;
		} else {
			// convert to a number
			wsif_v = wsif_v[1];
			var wsif_v_n = Number(wsif_v.replace(".", ""));
			// check if WSIF is from future of it is the unsupported 1.0.0
			if ((wsif_v_n == 100) || (wsif_v_n > Number(this.wsif.version.replace(".", "")))) {
				this.wsif_error(this.i18n.WSIF_NS_VER.sprintf(wsif_v));
				p = -1;
				fail = true;
			} else { // get number of expected pages (not when recursing)
				if (!recursing) {
					this.wsif.expected_pages = ct.substring(0,p).match(/^woas\.pages:\s+(\d+)$/m);
					if (this.wsif.expected_pages !== null)
						this.wsif.expected_pages = Number(this.wsif.expected_pages[1]);
				}
			}
		}
	}
	var title = null,	attrs = null,
		last_mod = null,	len = null,
		encoding = null,	disposition = null,
		d_fn = null,
		boundary = null,	mime = null;
	// position of last header end-of-line
	while (p != -1) {
		var sep, s, v;
		// remove prefix
		sep = ct.indexOf(":", p+pfx_len);
		if (sep == -1) {
			this.wsif_error(this.i18n.WSIF_NO_HN);
			fail = true;
			break;
		}
		// get attribute name
		s = ct.substring(p+pfx_len, sep);
		// get value
		p = ct.indexOf("\n", sep+1);
		if (p == -1) {
			this.wsif_error(this.i18n.WSIF_BAD_HV);
			fail = true;
			break;
		}
		// all headers except the title header can mark an end-of-block
		// the end-of-block is used to find boundaries and content inside
		// them
		if (s != "title")
			// save the last header position
			previous_h = p;
		// get value and apply left-trim
		v = ct.substring(sep+1, p).replace(/^\s*/, '');
		switch (s) {
			case "title":
				// we have just jumped over a page definition
				if (title !== null) {
					// do not import special/reserved pages
					if (and_save && (title.match(/^Special::/) || (this.static_pages2.indexOf(title) !== -1) || title.match(/^WoaS::Help::/) )) {
						++this.wsif.system_pages;
						title = attrs = last_mod = encoding = len =
							 boundary = disposition = mime = d_fn = null;
					} else {
						// store the previously parsed page definition
						p = this._native_page_def(path,ct,previous_h, p,overwrite,pre_import_hook,
								title,attrs,last_mod,len,encoding,disposition,
								d_fn,boundary,mime);
						// save page index for later analysis
						var was_title = title;
						title = attrs = last_mod = encoding = len =
							 boundary = disposition = mime = d_fn = null;
						if (p == -1) {
							fail = true;
							break;
						}
						// check if page was really imported, and if yes then
						// add page to list of imported pages
						if (this.wsif.imported_page !== false)
							imported.push(this.wsif.imported_page);
						else
							log("Import failure for "+was_title); //log:1
					}
					// delete the whole entry to free up memory to GC
					// will delete also the last read header
					ct = ct.substr(p);
					p = 0;
					previous_h = null;
					// update status if not recursing
					if (!recursing && (this.wsif.expected_pages !== null))
						this.progress_status(this.wsif.global_progress++/this.wsif.expected_pages);
				}
				// let's start with the next page
				title = this.ecma_decode(v);
			break;
			case "attributes":
				attrs = Number(v);
			break;
			case "last_modified":
				if (this.config.store_mts)
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
			case "disposition.filename":
				//TODO: ecma-escape
				d_fn = v;
			break;
			case "boundary":
				boundary = v;
			break;
			case "mime":
				mime = v;
			break;
			case "original_length":
				// this should be used for trimming base64 encrypted pages
				// ignored for now
			break;
			default:
				log("Unknown WSIF header: "+s);	//log:1
		} // end switch(s)
		if (fail)
			break;
		// set pointer to next entry
		p = ct.indexOf(pfx, p);
	}
/*	if (recursing) {
		this.alert("title = "+title+"\nattrs = "+attrs+"\nlast_mod = "+last_mod+"\n"+
  				"len = "+len+"\nencoding = "+encoding+"\ndisposition = "+disposition+
   				"\nboundary = "+boundary+"\n");
	} */
	if (fail) {
		if (!recursing)
			this.progress_finish();
		return false;
	}
	// process the last page (if any)
	if ((previous_h !== null) && (title !== null)) {
		p = this._native_page_def(path,ct,previous_h,0,overwrite,pre_import_hook,
				title,attrs,last_mod,len,encoding,disposition,
				d_fn,boundary,mime);
		// save page index for later analysis
		if (p == -1) {
			this.wsif_error( "Import error for page "+title+" after import!" );
			fail = true;
		} else {
			// check if page was really imported, and if yes then
			// add page to list of imported pages
			if (this.wsif.imported_page !== false)
				imported.push(this.wsif.imported_page);
			else
				log("Import failure for "+title); //log:1
			// update status if not recursing
			if (!recursing && (this.wsif.expected_pages !== null))
				this.progress_status(this.wsif.global_progress++/this.wsif.expected_pages);
		}
	}
	if (!recursing)
		this.progress_finish();
	// save imported pages
	if (imported.length) {
		if (and_save) {
			var ep = this.wsif.expected_pages;
			this.commit(imported);
			this.wsif.expected_pages = ep;
		}
		return imported.length;
	}
	// no pages were changed
	return 0;
};

woas._last_filename = null;

woas._get_path = function(id) {
	if (this.browser.firefox3 || this.browser.firefox_new)
		return this.dirname(ff3_getPath($(id)));
	// use the last used path
	if (this.browser.opera)
		return this.dirname(this._last_filename);
	// on older browsers this was allowed
	return this.dirname($(id).value);
};

woas._native_page_def = function(path,ct,p,last_p,overwrite,pre_import_hook, title,attrs,last_mod,len,encoding,
											disposition,d_fn,boundary,mime) {
	this.wsif.imported_page = false;
	var bpos_e, page;
	// last modified timestamp can be omitted
	if (last_mod === null)
		last_mod = 0;
	var fail = false;
	// attributes must be defined
	if (attrs === null) {
		log("No attributes defined for page "+title);	//log:1
		fail = true;
		// continue parsing
		return last_p;
	}

	switch (disposition) {
		case "inline":
		// craft the exact boundary match string
		boundary = "\n--"+boundary+"\n";
		// locate start and ending boundaries
		var bpos_s = ct.indexOf(boundary, p);
		if (bpos_s == -1) {
			this.wsif_error( "Failed to find start boundary "+boundary+" for page "+title );
			return -1;
		}
		bpos_e = ct.indexOf(boundary, bpos_s+boundary.length);
		if (bpos_e == -1) {
			this.wsif_error( "Failed to find end boundary "+boundary+" for page "+title );
			return -1;
		}
		while (!fail) { // used to break away
		// retrieve full page content
		page = ct.substring(bpos_s+boundary.length, bpos_e);
		// length used to check correctness of data segments
		var check_len = page.length;
		// split encrypted pages into byte arrays
		if (attrs & 2) {
			if (encoding != "8bit/base64") {
				log("Encrypted page "+title+" is not encoded as 8bit/base64");	//log:1
				fail = true;
				break;
			}
//			check_len = page.length;
			page = decode64_array(page);
			// trim to correct length
			// perhaps we could use woas.page.original_length field
			// also, we could not make this check if version is 0.10.4
			// but for now it's a good safety
			var rest = page.length % 16;
			if (rest)
				log("removing "+rest+" trailing bytes from page "+title); //log:1
			while (rest-- > 0) {page.pop();}
		} else if (attrs & 8) { // embedded image, not encrypted
			// NOTE: encrypted images are not obviously processed, as per previous 'if'
			if (encoding != "8bit/base64") {
				log("Image "+title+" is not encoded as 8bit/base64");	//log:1
				fail = true;
				break;
			}
			if (mime === null) {
				log("Image "+title+"has no mime type defined");		//log:1
				fail = true;
				break;
			}
			// re-add data:uri to images
			page = "data:"+mime+";base64,"+page;
		} else { // a normal wiki page
			switch (encoding) {
				case "8bit/base64":
					// base64 files will stay encoded
					if (!(attrs & 4))
						// WoaS does not encode pages normally, but this is supported by WSIF format
						page = decode64(page);
				break;
				case "ecma/plain":
					page = this.ecma_decode(page);
				break;
				case "8bit/plain": // plain wiki pages are supported
				break;
				default:
					log("Normal page "+title+" comes with unknown encoding "+encoding);	//log:1
					fail = true;
					break;
			}
		}
		if (fail)
			break;
		// check length (if any were passed)
		if (len !== null) {
			if (len != check_len)
				// show a simple log message
				log("Length mismatch for page %s: ought to be %d but was %d".sprintf(title, len, check_len)); //log:1
		}
		// has to break anyway
		break;
		} // wend
		// return pointer after last read header in case of failure
		if (fail)
			return bpos_e + boundary.length;
	break;
	case "external":	// import an external WSIF file
		if (d_fn === null) {
			this.wsif_error( "Page "+title+" is external but no filename was specified");
			return -1;
		}
		// use last filename to get path
		var the_dir;
		if (path === null) {
			the_dir = this._get_path("filename_");
			if (the_dir === false) {
				this.wsif_error( "Cannot retrieve path name in this browser");
				return -1;
			}
		} else {
			this.wsif_error( "Recursive WSIF import not implemented");
			return -1;
		}
		// embedded image/file, not encrypted
		if ((attrs & 4) || (attrs & 8)) {
			if (encoding != "8bit/plain") {
				this.wsif_error( "Page "+title+" is an external file/image but not encoded as 8bit/plain");
				return -1;
			}
			// load file and apply encode64 (if embedded)
			var wanted_mode;
			// images
			if ((attrs & 4) && (attrs & 8))
				wanted_mode = this.file_mode.DATA_URI;
			// files
			else if (attrs & 4)
				wanted_mode = this.file_mode.BASE64;
			else // dunnowhat
				wanted_mode = this.file_mode.BINARY;
			page = this.load_file(the_dir+d_fn, wanted_mode, mime);
			if (typeof page != "string") {
				this.wsif_error( "Failed load of external "+the_dir+d_fn);
				return -1;
			}
			// fallback wanted to apply real page definition later
			boundary = "";
			bpos_e = last_p;
		} else {
			if (encoding != "text/wsif") {
				this.wsif_error( "Page "+title+" is external but not encoded as text/wsif");
				return -1;
			}
			// check the result of external import
			var rv = this._native_wsif_load(the_dir+d_fn, locking, overwrite, false, true, pre_import_hook);
			if (rv === false)
				this.wsif_error( "Failed import of external "+the_dir+d_fn);
			// return pointer after last read header
			return last_p;
		}
	break;
	default: // no disposition or unknown disposition
		this.wsif_error( "Page "+title+" has invalid disposition: "+disposition);
		return -1;
	} // end of switch

	// check if we need to call the pre-import hook
	if (typeof pre_import_hook == "function") {
		var NP = { "title": title, "attrs": attrs, "page": page, "modified": false };
		if (!pre_import_hook(NP)) {
			// return updated offset
			return bpos_e+boundary.length;
		}
		if (NP.modified) {
			page = NP.page;
			title = NP.title;
			attrs = NP.attrs;
		}
		NP = null;
	}
	// check if page already exists
	var pi = page_titles.indexOf(title);
	if (pi !== -1) {
		if (overwrite) {
			// update the page record
			pages[pi] = page;
			page_attrs[pi] = attrs;
			page_mts[pi] = last_mod;
			// page title does not change
		} else
			log("Skipping already existing page "+title); //log:1
	} else { // creating a new page
		pi = page_titles.length;
		pages.push(page);
		page_attrs.push(attrs);
		page_mts.push(last_mod);
		page_titles.push(title);
	}
	// all OK
	this.wsif.imported_page = pi;
	// return updated offset
	return bpos_e+boundary.length;
};

woas.wsif_error = function(msg) {
	log("WSIF ERROR: "+msg);	//log:1
	this.wsif.emsg = msg;
};
