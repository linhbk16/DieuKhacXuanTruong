import unittest
from extract_catalogue import parse_caption


class CaptionTests(unittest.TestCase):
    def test_price_removal_preserves_last_dimension(self):
        result = parse_caption('161 - Phù điêu 150 x 50 350.000')
        self.assertEqual(result['categoryName'], 'Phù điêu')
        self.assertEqual(result['dimensions'], '150 × 50')

    def test_million_price_is_not_a_size(self):
        result = parse_caption('165 – Phù điêu 200 x100 1.000.000')
        self.assertEqual(result['dimensions'], '200 × 100')

    def test_number_does_not_become_category(self):
        self.assertTrue(parse_caption('118')['warnings'])
        self.assertEqual(parse_caption('118')['categoryName'], '')

    def test_no_invented_units(self):
        self.assertEqual(parse_caption('31 - Chân tròn 16 x 22')['dimensions'], '16 × 22')

    def test_letter_after_size_requires_review(self):
        self.assertTrue(parse_caption('07 - Cột tròn 20x20(vấu)')['warnings'])


if __name__ == '__main__':
    unittest.main()
