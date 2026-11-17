GEOID18 (NOAA/NGS, public domain) cut into 1x1 degree tiles for the Coordinate Converter.
Source: PROJ-data us_noaa_g2018u0.tif (CONUS) and us_noaa_g2018p0.tif (Puerto Rico / USVI), "Derived from work by NOAA. Public Domain".
File name: <south latitude>_<west longitude>.bin  (e.g. 32_91.bin covers 32..33 N, 91..90 W)
Layout: float32 base (m, little-endian), then 61x61 int16 = (N - base) * 1000, rows south->north, columns west->east, 1-minute spacing.
