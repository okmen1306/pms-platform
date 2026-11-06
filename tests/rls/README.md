# RLS Testleri

Bu klasördeki testler GERÇEK bir Supabase projesine (RLS aktif) ihtiyaç duyar ve `SUPABASE_TEST_URL`
+ `SUPABASE_TEST_ANON_KEY` ortam değişkenleri set edilmeden **atlanır** (skip). Senaryo kataloğu
için bkz. `docs/testing/rls-test-plan.md`. Bu testler go-live hazırlığında (roadmap Bölüm 16)
gerçek ortama karşı ilk kez tam olarak çalıştırılacak.
