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

// some constant for WoaS page attributes
define('_WOAS_ENCRYPTED', 2);
define('_WOAS_EMB_IMAGE', 8);
define('_WOAS_EMB_FILE', 8);

// the default hook used after a page has been loaded from WSIF source
// should return a positive integer if page was successfully created
// -1 to report failure
function _WSIF_create_page(&$WSIF, $title, &$page, $attrs) {
	echo sprintf("Page title:\t%s\nAttributes:\t%x\nLength:\t%d\n---\n",
				$title, $attrs, strlen($page));
	return 0;
}

class WSIF {

	// some private variables
	var $_expected_pages = null;
	var $_emsg = _WSIF_NO_ERROR;
	var $_imported_page = false;

	function Load($path, $create_page_hook = '_WSIF_create_page') {
		return $this->_wsif_load($path, $create_page_hook, 0);
	}
	
	function _wsif_load($path, $create_page_hook, $recursion = 0) {
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
			$v = trim(substr($ct, $sep+1, $p-$sep-1));
			switch ($s) {
				case "title":
					// we have just jumped over a page definition
					if ($title !== null) {
						// store the previously parsed page definition
						$p = $this->_page_def($create_page_hook, $path,$ct,$previous_h,$p,
								$title,$attrs,$last_mod,$len,$encoding,$disposition,
								$d_fn,$boundary,$mime, $recursion);
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
					$title = $this->ecma_decode($v);
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
			$p = $this->_page_def($create_page_hook, $path,$ct,$previous_h,0,
					$title,$attrs,$last_mod,$len,$encoding,$disposition,
					$d_fn,$boundary,$mime, $recursion);
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

	function _page_def($create_page_hook, $path,&$ct,$p,$last_p,
						$title,$attrs,$last_mod,$len,$encoding,
						$disposition,$d_fn,$o_boundary,$mime, $recursion = 0) {
		$this->_imported_page = false;
		if ($disposition == "inline") {
			// craft the exact boundary match string
			$boundary = "\n--".$o_boundary."\n";
			// locate start and ending boundaries
			$bpos_s = strpos($ct, $boundary, $p);
			if ($bpos_s === false) {
				$this->_emsg = "Failed to find start boundary ".$o_boundary." for page ".$title;
				return -1;
			}
			$bpos_e = strpos($ct, $boundary, $bpos_s+strlen($boundary));
			if ($bpos_e === false) {
				$this->_emsg = "Failed to find end boundary ".$o_boundary." for page ".$title;
				return -1;
			}
			// attributes must be defined
			if ($attrs === null) {
				$this->_log("No attributes defined for page ".$title);
				$fail = true;
			} else
				$fail = false;
			// last modified timestamp can be omitted
			if ($last_mod === null)
				$last_mod = 0;
			while (!$fail) { // used to easily break away
			// retrieve full page content
			$page = substr($ct, $bpos_s+strlen($boundary), $bpos_e-($bpos_s+strlen($boundary)));
			// length used to check correctness of data segments
			$check_len = strlen($page);
			// split encrypted pages into byte arrays
			if ($attrs & _WOAS_ENCRYPTED) {
				if ($encoding != "8bit/base64") {
					$this->_log("Encrypted page ".$title." is not encoded as 8bit/base64");
					$fail = true;
					break;
				}
				//NOTE: in original WoaS, the page would be split into an array of bytes
				$page = base64_decode($page);
			} else if ($attrs & _WOAS_EMB_IMAGE) { // embedded image, not encrypted
				// NOTE: encrypted images are not obviously processed, as per previous 'if'
				if ($encoding != "8bit/base64") {
					$this->_log("Image ".title." is not encoded as 8bit/base64");
					$fail = true;
					break;
				}
				if ($mime === null) {
					$this->_log("Image ".$title."has no mime type defined");
					$fail = true;
					break;
				}
				// re-add data:uri to images
				$page = "data:".$mime.";base64,".$page;
			} else { // a normal wiki page
				switch ($encoding) {
					case "8bit/base64":
						// base64 files will stay encoded
						if (!($attrs & _WOAS_EMB_FILE))
							// WoaS does not encode pages normally, but this is supported by WSIF format
							$page = base64_decode($page);
					break;
					case "ecma/plain":
						$page = $this->ecma_decode($page);
					break;
					case "8bit/plain": // plain wiki pages are supported
					break;
					default:
						$this->_log("Normal page ".$title." comes with unknown encoding ".$encoding);
						$fail = true;
						break;
				}
			}
			if ($fail)
				break;
			// check length (if any were passed)
			if ($len !== null) {
				if ($len != $check_len)
					$this->_log(sprintf("Length mismatch for page %s: ought to be %d but was %d", $title, $len, $check_len));
			}
			// has to break anyway
			break;
			} // wend
			
		} else if ($disposition == "external") { // import an external WSIF file
			// embedded image/file, not encrypted
			if (($attrs & _WOAS_EMB_FILE) || (attrs & _WOAS_EMB_IMAGE)) {
				if ($encoding != "8bit/plain") {
					$this->_emsg = "Page ".$title." is an external file/image but not encoded as 8bit/plain";
					return -1;
				}
			} else {
				if ($encoding != "text/wsif") {
					$this->_emsg = "Page ".$title." is external but not encoded as text/wsif";
					return -1;
				}
			}
			if ($d_fn === null) {
				$this->_emsg = "Page ".$title." is external but no filename was specified";
				return -1;
			}
			if ($recursion > 0) {
				$this->_emsg = "Recursive WSIF import not implemented";
				return -1;
			}
			// check the result of external import
			$rv = $this->_wsif_load(dirname($path).'/'.$d_fn, $recursion+1);
			if ($rv === false) {
				$this->_emsg = "Failed import of external ".$d_fn."\n".$this->_emsg;
				//TODO: some more error logging?
			}
			// return pointer after last read header
			return $last_p;
		} else { // no disposition or unknown disposition
			$this->_emsg = "Page ".$title." has invalid disposition: ".$disposition;
			return -1;
		}
		
		if (!$fail) {
			$rv = $create_page_hook($this, $title, $page, $attrs);
			if ($rv != -1)
				// all OK
				$this->_imported_page = $rv;
		} // !fail
		// return updated offset
		return $bpos_e+strlen($boundary);
	}

} // class WSIF

?>
