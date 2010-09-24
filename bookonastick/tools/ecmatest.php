#!/usr/bin/php
<?php
## Test ECMA-encoding
## @author legolas558
## @version 0.1.0
#

require dirname(__FILE__).'/libwsif.php';

$WSIF = new WSIF();

$rv = 0;

// perform test with infinity symbol
$test = "This is infinity symbol: ∞ ";

echo "Test string: '$test'\n";
echo "Needs encoding: ".($WSIF->_needs_ecma_encoding($test) ? 'yes' : 'no')."\n";
echo "ECMA-encoded test string: '".$WSIF->ecma_encode($test)."'\n";

exit($rv);

?>
