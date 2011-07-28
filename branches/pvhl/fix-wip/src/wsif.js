// @module wsif

woas.wsif = {
	version: "1.3.1",			// version of WSIF format being used
	DEFAULT_INDEX: "index.wsif",
	emsg: null,
	imported: [],				// _native_page_def() will always add imported pages here
	expected_pages: null,
	global_progress: 0,
	generator: { version: null, name: null },
	header: function(header_name, value) {
		return header_name+": "+value+"\n";
	},
	inline: function(boundary, content) {
		return "\n--"+boundary+"\n"+content+"\n--"+boundary+"\n";
	},
	_generate_random_boundary: function(old_boundary, text) {
		var b = old_boundary;
		if (!b.length)
			b = _random_string(10);
		while (text.indexOf(b) != -1) {
			b = _random_string(10);
		}
		return b;
	},
	do_error: function(msg) {
		woas.log("WSIF ERROR: "+msg);	//log:1
		this.emsg = msg;
	},
	
	reMimeMatch: /^data:\s*([^;]*);\s*base64,\s*/
};

// properly calculate an incremental value for version strings
// we consider each place is worth 10^2
woas._version_to_int = function(s) {
	// split into all tokens
	var v = s.split("."), rv = 0;
	for(var i=v.length-1;i >= 0;--i) {
		rv += (v[i] * Math.pow(100, v.length-i-1));
	}
	return rv;
};

woas._normver = function(s) {
	// to be enabled after 1.0.0 release
	//var rv = this._version_to_int(s);
	//if (rv >= 10000) return rv;
	return parseInt(s.replace(/\./g, ""));
};

// default behavior:
// - wiki pages go inline (utf-8), no container encoding
// - embedded files/images go outside as blobs
// - encrypted pages go inline in base64
woas._native_wsif_save = function(path, src_fname, locking, single_wsif, inline_wsif, author,
							save_all, plist) {

	this.progress_init("WSIF save");
	
	// prepare the extra headers
	var extra = this.wsif.header('wsif.version', this.wsif.version);
	extra += this.wsif.header('wsif.generator', 'woas');
	extra += this.wsif.header('wsif.generator.version', this.version);
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
			if (/^(Special::|WoaS::Help::|WoaS History)/.test(page_titles[pi])) continue;
			if (this.static_pages2.indexOf(page_titles[pi]) !== -1) continue;
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
			ct = this.base64.encode_array(pages[pi]);
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
						m = ct.match(this.wsif.reMimeMatch);
						record += this.wsif.header(pfx+"mime", m[1]);
						// remove the matched part
						ct = this.base64.decode(ct.substr(m[0].length));
					} else { // no data:uri for files
						ct = this.base64.decode(ct);
					}
				} else {
					encoding = "8bit/base64";
					if (this.is__image(pi)) {
						m = ct.match(this.wsif.reMimeMatch);
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
			boundary = this.wsif._generate_random_boundary(boundary, ct);
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
				woas.log("Could not save "+blob_fn);	//log:1
			// release any lock held previously
			if (locking)
				this.lock.release(path+blob_fn);
		}
		// the page record is now ready, proceed to save
		if (single_wsif) {// append to main page record
			full_wsif += record;
			++done;
		} else { // save each page separately
			if (this.save_file(path+pi.toString()+".wsif",
								this.file_mode.ASCII_TEXT,
								// also add the pages counter (single)
								extra + this.wsif.header("woas.pages", 1) +
								"\n" + record))
				++done;
		}
		this.progress_status(done/l);
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
/**
PVHL: need to quickly fix (with minimal side-effects) a really bad bug in saving to a bad data source.
if done == 0 here then there has been a failure in saving; blob failure will pass though -- this is
a separate bug that needs to be fixed as well; I am not addressing that bug at this time.
So: if !done don't save index. return value of 0 signals save failed; this is used to stop a save
of the html file -- otherwise a bad data source value wipes out the wiki.
*/
	if (done && !this.save_file(path+src_fname,
						this.file_mode.ASCII_TEXT,
						extra + "\n" + full_wsif)) {
		//if (single_wsif) - needs to be for any save type
			done = 0;
	} // we do not increment page counter when saving index.wsif
	
	// release any lock held previously
	if (locking)
		this.lock.release(path+src_fname);
	
	this.progress_finish();
	return done; // PVHL: if 0 save failed
};

woas._wsif_ds_load = function(subpath, locking) {
	// we reset the arrays before loading the real data from index.wsif
	pages = [];
	page_attrs = [];
	page_titles = [];
	page_mts = [];
	// get the data
	return this._native_wsif_load(woas.ROOT_DIRECTORY+subpath, locking, true, 0,
			this.importer._inject_import_hook);
};

/* description of parameters:
 - path: WSIF file path which will be loaded, can be null to use file specified in '_filename' element
 - locking: resource locking (not yet implemented)
 - _native: true when WoaS is in native mode (private use only)
 - recursing: recursion depth variable, starts with 0
 - import_hook: callback used to actually import the page
 - title_filter_hook: callback used to choose if page can be imported or not by title - optional
 - finalization_hook: callback used when import is finished
*/
woas._native_wsif_load = function(path, locking, _native, recursing, import_hook,
								title_filter_hook, finalization_hook) {
	if (!recursing) {
		this.wsif.emsg = null;
		this.progress_init("Initializing WSIF import");
	}
	var ct;
	// allow remote loading when running in native WSIF mode
	if (this._server_mode && (this.config.wsif_ds.length !== 0))
		ct = this.remote_load(path);
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
		this.wsif.imported = [];
		this.wsif.global_progress = 0;
		this.wsif.generator = { version: null, name: null };
	}
	var pfx = "\nwoas.page.", pfx_len = pfx.length;
	// start looping to find each page
	var p = ct.indexOf(pfx), fail = false,
	// this is used to mark end-of-block
		previous_h = null;
	// too early failure
	if (p === -1)
		this.wsif.do_error("Invalid WSIF file");
	else { // OK, first page was located, now get some general WSIF info
		var wsif_v = ct.substring(0,p).match(/^wsif\.version:\s+(.+)$/m);
		if (wsif_v === null) {
			this.wsif.do_error(this.i18n.WSIF_NO_VER);
			p = -1;
			fail = true;
		} else {
			// convert to a number
			wsif_v = wsif_v[1];
			var wsif_v_n = this._normver(wsif_v);
			// check if WSIF is from future of it is the unsupported 1.0.0
			if ((wsif_v_n == 100) || (wsif_v_n > this._normver(this.wsif.version))) {
				this.wsif.do_error(this.i18n.WSIF_NS_VER.sprintf(wsif_v));
				p = -1;
				fail = true;
			} else {
				if (!recursing) {
					// get number of expected pages
					this.wsif.expected_pages = ct.substring(0,p).match(/^woas\.pages:\s+(\d+)$/m);
					if (this.wsif.expected_pages !== null)
						this.wsif.expected_pages = Number(this.wsif.expected_pages[1]);
					// gather generator information
					this.wsif.generator.name = ct.substring(0,p).
						match(/^wsif\.generator:\s+(.+)$/m);
					if (this.wsif.generator.name !== null) {
						this.wsif.generator.name = this.wsif.generator.name[1];
						this.wsif.generator.version = ct.substring(0,p).
							match((wsif_v_n < 131) ? /^woas\.version:\s+(.+)$/m : /^wsif\.generator\.version:\s+(.+)$/m);
						if (this.wsif.generator.version !== null) {
							this.wsif.generator.version = this.wsif.generator.version[1];
						}
					}

					// was generator information truly necessary?
					if (this.wsif.generator.name === "woas") {
						if (this.wsif.generator.version === null) {
							this.wsif.do_error("WSIF generator version is not available");
							p = -1;
							fail = true;
						} else {
							if (!_native)
								// copy to importer module
								this.importer._old_version = this._normver(this.wsif.generator.version);
							else { // native mode
								if (this.wsif.generator.version !== this.version) {
									this.wsif.do_error("WSIF generator version should match WoaS version");
									p = -1;
									fail = true;
								}
							}
						}
					} else {
						if (!_native) {
							// assume that any content generated with libwsif is up-to-date for import
							this.importer._old_version = this._normver(this.version);
						} else { // native mode
							this.wsif.do_error("WSIF generator is not 'woas'");
							p = -1;
							fail = true;
						}
					}

				} // !recursing
			} // valid version
		} // has version
	}
	var title = null,	attrs = null,
		last_mod = null,	len = null,
		encoding = null,	disposition = null,
		d_fn = null,	boundary = null,	mime = null;
	// position of last header end-of-line
	var sep, s, v, last_offset;
	while (p !== -1) {
		// save last entry offset, used by page definition
		last_offset = p;
		// remove prefix
		sep = ct.indexOf(":", p+pfx_len);
		if (sep === -1) {
			this.wsif.do_error(this.i18n.WSIF_NO_HN);
			fail = true;
			break;
		}
		// get attribute name
		s = ct.substring(p+pfx_len, sep);
		// get value
		p = ct.indexOf("\n", sep+1);
		if (p == -1) {
			this.wsif.do_error(this.i18n.WSIF_BAD_HV);
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
					var skip_page;
					if (typeof title_filter_hook == "function")
						skip_page = !title_filter_hook(title);
					else skip_page = false;
					if (skip_page) {
						title = attrs = last_mod = encoding = len =
							 boundary = disposition = mime = d_fn = null;
					} else {
						// store the previously parsed page definition
						var rv = this._native_page_def(path,ct,
								previous_h, last_offset,	// offsets to grab the page content
								import_hook,
								title,attrs,last_mod,len,encoding,disposition,
								d_fn,boundary,mime,locking,_native,title_filter_hook);
						// save page index for later analysis
						var was_title = title;
						title = attrs = last_mod = encoding = len =
							 boundary = disposition = mime = d_fn = null;
						if (!rv) // show a message but continue parsing
							woas.log("Import failure for "+was_title); //log:1
					}
					// delete the whole entry to free up memory to GC
					// will delete also the last read header (p != last_offset)
					ct = ct.substr(p);
					last_offset = p = 0;
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
				woas.log("Unknown WSIF header: "+s);	//log:1
		} // end switch(s)
		if (fail)
			break;
		// set pointer to next entry
		p = ct.indexOf(pfx, p);
	}
	if (fail) {
		if (!recursing)
			this.progress_finish();
		return false;
	}
	// process the last page (if any)
	if ((previous_h !== null) && (title !== null)) {
		var skip_page;
		if (typeof title_filter_hook == "function")
			skip_page = !title_filter_hook(title);
		else skip_page = false;
		if (!skip_page) {
			var rv = this._native_page_def(path,ct,previous_h,last_offset,
					import_hook,
					title,attrs,last_mod,len,encoding,disposition,
					d_fn,boundary,mime,locking,_native,title_filter_hook);
			// save page index for later analysis
			if (!rv)
				this.wsif.do_error( "Import error for page "+title+" after import!" );
			// update status if not recursing
			if (!recursing && (this.wsif.expected_pages !== null))
				this.progress_status(this.wsif.global_progress++/this.wsif.expected_pages);
		}
	}
	if (!recursing) {
		this.progress_finish();
		// call the finalization callback (if any)
		if (typeof finalization_hook == "function")
			finalization_hook();
	}
	// return total imported pages
	return this.wsif.imported.length;
};

// returns true if a page was defined, and save it in wsif.imported array
woas._native_page_def = function(path,ct,p,last_p,import_hook,
								title,attrs,last_mod,len,encoding,disposition,d_fn,boundary,mime,locking,_native,title_filter_hook) {
	var bpos_e, page;
	// attributes must be defined unless importing an exported multifile index.wsif
	if (attrs === null && !(disposition === "external" && encoding === "text/wsif")) {
		woas.log("No attributes defined for page "+title);	//log:1
		return false;
	}
	// disposition must be defined
	if (disposition === null) {
		woas.log("No disposition defined for page \""+title+"\"");	//log:1
		return false;
	}
	// last modified timestamp can be omitted
	if (last_mod === null)
		last_mod = 0;
		
	switch (disposition) {
		case "inline":
		// craft the exact boundary match string
		boundary = "\n--"+boundary+"\n";
		// locate start and ending boundaries
		var bpos_s = ct.indexOf(boundary, p);
		if (bpos_s == -1) {
			this.wsif.do_error( "Failed to find start boundary "+boundary+" for page "+title );
			return false;
		}
		bpos_e = ct.indexOf(boundary, bpos_s+boundary.length);
		if (bpos_e == -1) {
			this.wsif.do_error( "Failed to find end boundary "+boundary+" for page "+title );
			return false;
		}
		// retrieve full page content
		page = ct.substring(bpos_s+boundary.length, bpos_e);
		// length used to check correctness of data segments
		var check_len = page.length;
		// split encrypted pages into byte arrays
		if (attrs & 2) {
			if (encoding != "8bit/base64") {
				woas.log("Encrypted page "+title+" is not encoded as 8bit/base64");	//log:1
				return false;
			}
//			check_len = page.length;
			page = this.base64.decode_array(page);
			// trim to correct length
			// perhaps we could use woas.page.original_length field
			// also, we could not make this check if version is 0.10.4
			// but for now it's a good safety
			var rest = page.length % 16;
			if (rest)
				woas.log("NOTICE: removing "+rest+" trailing bytes from page "+title); //log:1
			while (rest-- > 0) {page.pop();}
		} else if (attrs & 8) { // embedded image, not encrypted
			// NOTE: encrypted images are not obviously processed, as per previous 'if'
			if (encoding != "8bit/base64") {
				woas.log("Image "+title+" is not encoded as 8bit/base64");	//log:1
				return false;
			}
			if (mime === null) {
				woas.log("Image "+title+"has no mime type defined");		//log:1
				return false;
			}
			// re-add data:uri to images
			page = "data:"+mime+";base64,"+page;
		} else { // a normal wiki page
			switch (encoding) {
				case "8bit/base64":
					// base64 files will stay encoded
					if (!(attrs & 4))
						// WoaS does not encode pages normally, but this is supported by WSIF format
						page = this.base64.decode(page);
				break;
				case "ecma/plain":
					page = this.ecma_decode(page);
				break;
				case "8bit/plain": // plain wiki pages are supported
				break;
				default:
					woas.log("Normal page "+title+" comes with unknown encoding "+encoding);	//log:1
					return false;
			}
		}
		// check length (if any were passed)
		if (len !== null) {
			if (len != check_len)
				// show a simple log message
				woas.log("Length mismatch for page %s: ought to be %d but was %d".sprintf(title, len, check_len)); //log:1
		}
		// fallback wanted to go to define the page
	break;
	case "external":	// import an external WSIF file
		if (d_fn === null) {
			this.wsif.do_error( "Page "+title+" is external but no filename was specified");
			return false;
		}
		// use last filename to get path
		var the_dir;
		if (path === null) {
			the_dir = this._get_path("filename_");
			if (the_dir === false) {
				this.wsif.do_error( "Cannot retrieve path name in this browser");
				return false;
			}
		} else {
			this.wsif.do_error( "Recursive WSIF import not implemented");
			return false;
		}
		// embedded image/file, not encrypted
		if ((attrs & 4) || (attrs & 8)) {
			if (encoding !== "8bit/plain") {
				this.wsif.do_error( "Page "+title+" is an external file/image but not encoded as 8bit/plain");
				return false;
			}
			// load file and apply base64 encoding if embedded
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
				this.wsif.do_error( "Failed load of external "+the_dir+d_fn);
				return false;
			}
			// fallback wanted to apply real page definition later
		} else {
			if (encoding != "text/wsif") {
				this.wsif.do_error( "Page "+title+" is external but not encoded as text/wsif");
				return false;
			}
			// check the result of external import
			var rv = this._native_wsif_load(the_dir+d_fn, locking, _native,
											1, import_hook, title_filter_hook);
			if (rv === false)
				this.wsif.do_error( "Failed import of external "+the_dir+d_fn);
			// return pointer after last read header
			return rv;
		}
	break;
	default: // no disposition or unknown disposition
		this.wsif.do_error( "Page "+title+" has invalid disposition: "+disposition);
		return false;
	} // end of switch

	// create the page object
	var NP = { "title": title, "attrs": attrs, "body": page, "mts": last_mod };
	
	// check that this was imported successfully
	if (import_hook( NP ) ) {
		// all OK
		this.wsif.imported.push(NP.i);
		return true;
	}

	return false;
};
