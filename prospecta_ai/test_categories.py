import unittest
from app import app, CATEGORIES

class CategoriaTest(unittest.TestCase):
    def test_todas_as_categorias_em_duas_cidades(self):
        client=app.test_client()
        for cidade in ("Mauá","Santo André"):
            for segmento in CATEGORIES:
                with self.subTest(cidade=cidade,segmento=segmento):
                    response=client.get("/api/search",query_string={"cidade":cidade,"segmento":segmento})
                    self.assertEqual(response.status_code,200,response.get_data(as_text=True))
                    payload=response.get_json()
                    rows=payload["resultados"]
                    self.assertGreaterEqual(len(rows),1)
                    for entry in rows:
                        self.assertTrue(entry["nome"].strip())
                        self.assertTrue(entry["fonte"].startswith("https://"))
                        self.assertIn("endereco",entry)
                        self.assertIn("whatsapp",entry)
    def test_maua_sem_acento(self):
        self.assertEqual(app.test_client().get("/api/search",query_string={
            "cidade":"Maua","segmento":"Padarias"}).status_code,200)
    def test_invalid_category(self):
        self.assertEqual(app.test_client().get("/api/search",query_string={
            "cidade":"Mauá","segmento":"Inventado"}).status_code,400)
if __name__=="__main__":unittest.main()
