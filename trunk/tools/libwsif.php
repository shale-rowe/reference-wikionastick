<?php
## WSIF support library
## @author legolas558
## @version 1.0.0
##
## offers basic support for WSIF format
## Wiki on a Stick Project
## @url http://stickwiki.sf.net/
#

define('_WSIF_VERSION', '1.1.0');

define('_WSIF_NO_ERROR', "No error");
define('_WSIF_NS_VER', "WSIF version %s not supported!");
define('WSIF_NO_VER', "Could not read WSIF version");

class WSIF {

	// some private variables
	var $_expected_pages = null;
	var $_emsg = _WSIF_NO_ERROR;
	var $_imported_page = false;

	function Load($path, $pre_page_hook = null, $after_page_hook = null) {
		$ct = @file_get_contents($path);
		if ($ct === false)
			return false;
		// the imported pages
		$imported = array();
		$pfx = "\nwoas.page.";
		$pfx_len = strlen($pfx);
		$fail = false;
		// start looping to find each page
		$p = strpos($ct, $pfx);
		// this is used to mark end-of-block
		$previous_h = null;
		// too early failure
		if ($p === false)
			$this->_emsg = "Invalid WSIF file";
		else { // OK, first page was located, now get some general WSIF info
			if (!preg_match("/^wsif\\.version:\\s+(.*)$/m", substr($ct, 0,p), $wsif_v)) {
				$this->_emsg = this.i18n.WSIF_NO_VER;
				$p = false;
				$fail = true;
			} else {
				// convert to a number
				$wsif_v = $wsif_v[1];
				if (strnatcmp($wsif_v, _WSIF_VERSION)<0) {
					$this->_emsg = sprintf(_WSIF_NS_VER, $wsif_v);
					$p = false;
					$fail = true;
				} else { // get number of expected pages
					if (preg_match("/^woas\\.pages:\\s+(\\d+)$/m", substr(ct,0,p), $this->_expected_pages))
						$this->_expected_pages = (int)$this->_expected_pages[1];
				}
			}
		}
		// initialize all the page properties
		$title = $attrs = $last_mod = $len =
				$encoding = $disposition = $d_fn =
				$boundary = $mime = null;
		// position of last header end-of-line
		while ($p !== false) {
			// remove prefix
			$sep = strpos($ct, ":", $p+$pfx_len);
			if ($sep === false) {
				$this->_emsg = _WSIF_NO_HN;
				$fail = true;
				break;
			}
			// get attribute name
			$s = substr($ct,$p+$pfx_len, $sep-$p-$pfx_len);
			// get value
			$p = strpos($ct, "\n", $sep+1);
			if ($p === false) {
				$this->_emsg = _WSIF_BAD_HV;
				$fail = true;
				break;
			}
			// all headers except the title header can mark an end-of-block
			// the end-of-block is used to find boundaries and content inside
			// them
			if ($s != "title")
				// save the last header position
				$previous_h = $p;
			// get value and apply left-trim
			$v = trim(substr($ct, $sep+1, $p-$sep-1);
			switch ($s) {
				case "title":
					// we have just jumped over a page definition
					if ($title !== null) {
						// store the previously parsed page definition
						$p = $this->_page_def($path,$ct,$previous_h,$p,
								$title,$attrs,$last_mod,$len,$encoding,$disposition,
								$d_fn,$boundary,$mime);
						// save page index for later analysis
						$was_title = title;
						$title = $attrs = $last_mod = $encoding = $len =
							 $boundary = $disposition = $mime = $d_fn = null;
						if ($p === false) {
							$fail = true;
							break 2;
						}
						// check if page was really imported, and if yes then
						// add page to list of imported pages
						if ($this->_imported_page !== false)
							$imported[] = $this->_imported_page;
						else
							$this->_log("Import failure for "+was_title); //log:1
						// delete the whole entry to free up memory to GC
						// will delete also the last read header
						$ct = substr($ct, p);
						$p = 0;
						$previous_h = null;
					}
					// let's start with the next page
					$title = $this->_ecma_decode($v);
				break;
				case "attributes":
					$attrs = (int)$v;
				break;
				case "last_modified":
					$last_mod = (int)$v;
				break;
				case "length":
					$len = (int)$v;
				break;
				case "encoding":
					$encoding = $v;
				break;
				case "disposition":
					$disposition = $v;
				break;
				case "disposition.filename":
					$d_fn = $v;
				break;
				case "boundary":
					$boundary = $v;
				break;
				case "mime":
					$mime = $v;
				break;
				default:
					$this->_log("Unknown WSIF header: ".$s);
			} // end switch(s)
//			if ($fail)				break;
			// set pointer to next entry
			$p = strpos($ct, $pfx, $p);
		}
		if ($fail)
			return false;
		// process the last page (if any)
		if (($previous_h !== null) && ($title !== null)) {
			$p = $this->_page_def($path,$ct,$previous_h,0,
					$title,$attrs,$last_mod,$len,$encoding,$disposition,
					$d_fn,$boundary,$mime);
			// save page index for later analysis
			if ($p === false) {
				$this->_emsg = sprintf(_WSIF_IMPORT_FAILURE, $title);
				$fail = true;
			} else {
				// check if page was really imported, and if yes then
				// add page to list of imported pages
				if ($this->_imported_page !== false)
					$imported[] = $this->_imported_page;
				else
					$this->_log("Import failure for "+title); //log:1
			}
		}
		// save imported pages
		return count($imported);
	}

	function _page_def($path,&$ct,$p,$last_p,
						$title,$attrs,$last_mod,$len,$encoding,
						$disposition,$d_fn,$boundary,$mime) {
		$this->_imported_page = false;
		if ($disposition == "inline") {
			// craft the exact boundary match string
			$boundary = "\n--".$boundary."\n";
			// locate start and ending boundaries
			$bpos_s = strpos($ct, $boundary, $p);
			if (bpos_s == -1) {
				this.wsif.emsg = "Failed to find start boundary "+boundary+" for page "+title;
				return -1;
			}
			var bpos_e = ct.indexOf(boundary, bpos_s+boundary.length);
			if (bpos_e == -1) {
				this.wsif.emsg = "Failed to find end boundary "+boundary+" for page "+title;
				return -1;
			}
			var fail = false;
			// attributes must be defined
			if (attrs === null) {
				log("No attributes defined for page "+title);
				fail = true;
			}
			// last modified timestamp can be omitted
			if (last_mod === null)
				last_mod = 0;
			while (!fail) { // used to break away
			// retrieve full page content
			var page = ct.substring(bpos_s+boundary.length, bpos_e);
			// length used to check correctness of data segments
			var check_len = page.length;
			// split encrypted pages into byte arrays
			if (attrs & 2) {
				if (encoding != "8bit/base64") {
					log("Encrypted page "+title+" is not encoded as 8bit/base64");
					fail = true;
					break;
				}
	//			check_len = page.length;
				page = decode64_array(page);
			} else if (attrs & 8) { // embedded image, not encrypted
				// NOTE: encrypted images are not obviously processed, as per previous 'if'
				if (encoding != "8bit/base64") {
					log("Image "+title+" is not encoded as 8bit/base64");
					fail = true;
					break;
				}
				if (mime === null) {
					log("Image "+title+"has no mime type defined");
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
						log("Normal page "+title+" comes with unknown encoding "+encoding);
						fail = true;
						break;
				}
			}
			if (fail)
				break;
			// check length (if any were passed)
			if (len !== null) {
				if (len != check_len)
					this.alert("Length mismatch for page %s: ought to be %d but was %d".sprintf(title, len, check_len));
			}
			// has to break anyway
			break;
			} // wend
			
		} else if (disposition == "external") { // import an external WSIF file
			// embedded image/file, not encrypted
			if ((attrs & 4) || (attrs & 8)) {
				if (encoding != "8bit/plain") {
					this.wsif.emsg = "Page "+title+" is an external file/image but not encoded as 8bit/plain";
					return -1;
				}
			} else {
				if (encoding != "text/wsif") {
					this.wsif.emsg = "Page "+title+" is external but not encoded as text/wsif";
					return -1;
				}
			}
			if (d_fn === null) {
				this.wsif.emsg = "Page "+title+" is external but no filename was specified";
				return -1;
			}
			// get proper path
			if (path === null) {
				path = this.get_path("filename_");
				if (path === false) {
					this.wsif.emsg = "Cannot retrieve path name in this browser";
					return -1;
				}
			} else {
				this.wsif.emsg = "Recursive WSIF import not implemented";
				return -1;
			}
			// check the result of external import
			var rv = this._native_wsif_load(this.dirname(path)+d_fn, overwrite, false, true);
			if (rv === false) {
				this.wsif.emsg = "Failed import of external "+d_fn+"\n"+this.wsif.emsg;
				p = -1;
			}
			// return pointer after last read header
			return last_p;
		} else { // no disposition or unknown disposition
			this.wsif.emsg = "Page "+title+" has invalid disposition: "+disposition;
			return -1;
		}
		
		if (!fail) {
			// check if page already exists
			var pi = page_titles.indexOf(title);
			if (pi != -1) {
				if (overwrite) {
					// update the page record
					pages[pi] = page;
					page_attrs[pi] = attrs;
					page_mts[pi] = last_mod;
					// page title does not change
				} else
					log("Skipping page "+title); //log:1
			} else { // creating a new page
				pages.push(page);
				page_attrs.push(attrs);
				page_mts.push(last_mod);
				page_titles.push(title);
			}
		} // !fail
		// return pointer after last read header
	//	return last_p;
		// all OK
		this.wsif.imported_page = pi;
		// return updated offset
		return bpos_e+boundary.length;
	}


?>
