// DentaPro domain module: extracted from the original implementation.
// ADMIN PANEL
// =====================
var deleteTargetId = null;
var editingProductId = null;

function closeAdmin() {
  document.getElementById('adminPanel').classList.remove('open');
}

var LOW_STOCK_THRESHOLD = 5;

function getLowStockProducts() {
  return products.filter(p =>
    p.stock !== undefined && p.stock !== null && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD
  );
}

function updateAdminStats() {
  document.getElementById('adminStatTotal').textContent = products.length;
  document.getElementById('adminStatCats').textContent = new Set(products.map(p => p.cat)).size;
  document.getElementById('adminStatOffers').textContent = products.filter(p => p.old).length;
  document.getElementById('adminStatNew').textContent = products.filter(p => p.badge === 'جديد').length;
  renderLowStockBanner();
}

function renderLowStockBanner() {
  const existing = document.getElementById('lowStockBanner');
  if (existing) existing.remove();

  const lowStock = getLowStockProducts();
  if (!lowStock.length) return;

  const banner = document.createElement('div');
  banner.id = 'lowStockBanner';
  banner.style.cssText = `
    margin: 0 28px 16px; padding: 14px 20px; border-radius: 14px;
    background: linear-gradient(135deg, #fff7ed, #fffbeb);
    border: 2px solid #f59e0b; display: flex; align-items: center;
    justify-content: space-between; gap: 12px; flex-wrap: wrap;
  `;
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:24px">⚠️</div>
      <div>
        <div style="font-weight:800;font-size:14px;color:#92400e">
          تنبيه: ${lowStock.length} منتج على وشك النفاد
        </div>
        <div style="font-size:12px;color:#92400e;margin-top:2px">
          ${lowStock.slice(0,3).map(p => `${escHtml(p.ar)} (${p.stock})`).join(' · ')}${lowStock.length > 3 ? ' ...' : ''}
        </div>
      </div>
    </div>
    <button onclick="document.getElementById('adminCatFilter').value='all';document.getElementById('adminSearch').value='';renderAdminTable();this.closest('div').scrollIntoView()"
      style="padding:8px 18px;border-radius:50px;background:#f59e0b;color:#fff;border:none;
             font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">
      عرض الكل
    </button>`;

  const statsGrid = document.getElementById('adminStatTotal').closest('div[style*="grid"]');
  statsGrid.parentNode.insertBefore(banner, statsGrid.nextSibling);
}

function renderAdminTable() {
  const search = document.getElementById('adminSearch').value.toLowerCase();
  const catFilter = document.getElementById('adminCatFilter').value;
  const catNames = {dev:'أجهزة',hand:'أدوات يدوية',mat:'مواد طبية',prot:'وقاية',ortho:'تقويم',impl:'زراعة',home:'منزلية'};
  const badgeColors = {'جديد':'#0a5c8a','الأكثر مبيعاً':'#e53e3e','':''};

  let list = products.filter(p => {
    const matchSearch = !search || p.ar.includes(search) || p.en.toLowerCase().includes(search) || p.brand.toLowerCase().includes(search);
    const matchCat = catFilter === 'all' || p.cat === catFilter;
    return matchSearch && matchCat;
  });

  list = [...list].sort((a,b) => a.ar.localeCompare(b.ar, 'ar'));

  const tbody = document.getElementById('adminTableBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:0">
      <div class="empty-orders" style="padding:48px 24px">
        <i class="fas fa-box-open"></i>
        <h3>لا توجد منتجات مطابقة</h3>
        <p>جرّب تغيير كلمة البحث أو الفئة المحددة</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((p, idx) => `
    <tr style="border-bottom:1px solid #f0f4f8;transition:background 0.15s" onmouseover="this.style.background='#f8fbfd'" onmouseout="this.style.background=''">
      <td style="padding:14px 16px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:26px;flex-shrink:0;text-align:center;font-weight:800;font-size:12px;color:var(--text-muted)">${idx+1}</div>
          <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#f0f8ff,#e8f3fb);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden">
            ${p.image
              ? `<img src="${cldOptimize(p.image, 80)}" style="width:100%;height:100%;object-fit:contain" loading="lazy" decoding="async">`
              : escHtml(p.icon || '')}
          </div>
          <div>
            <div style="font-weight:700;font-size:14px;color:#0f2133">${escHtml(p.ar)}</div>
            <div style="font-size:12px;color:#5a7a90">${escHtml(p.brand)} · ${escHtml(p.en.substring(0,30))}${p.en.length>30?'...':''}</div>
            ${p.points ? `<div style="margin-top:4px"><span style="background:rgba(245,158,11,0.15);color:#d97706;border-radius:50px;padding:2px 10px;font-size:11px;font-weight:800">🏆 ${p.points} نقطة</span></div>` : ''}
            ${(p.stock !== undefined && p.stock !== null) ? `<div style="margin-top:4px"><span style="background:${p.stock<=0?'rgba(229,62,62,0.12)':(p.stock<=LOW_STOCK_THRESHOLD?'rgba(245,158,11,0.15)':'rgba(16,185,129,0.12)')};color:${p.stock<=0?'#e53e3e':(p.stock<=LOW_STOCK_THRESHOLD?'#d97706':'#059669')};border-radius:50px;padding:2px 10px;font-size:11px;font-weight:800">${p.stock<=0?'⛔ نفذت الكمية':(p.stock<=LOW_STOCK_THRESHOLD?'⚠️ منخفض: '+p.stock:'📦 المخزون: '+p.stock)}</span></div>` : ''}
          </div>
        </div>
      </td>
      <td style="padding:14px 16px">
        <span style="padding:4px 12px;border-radius:50px;background:#e8f3fb;color:#0a5c8a;font-size:12px;font-weight:700">${catNames[p.cat]||p.cat}</span>
      </td>
      <td style="padding:14px 16px;font-weight:800;color:#0a5c8a;font-size:15px">${p.price.toLocaleString()} د.أ</td>
      <td style="padding:14px 16px;color:#5a7a90;font-size:13px;text-decoration:line-through">${p.old ? p.old.toLocaleString()+' د.أ' : '—'}</td>
      <td style="padding:14px 16px">
        ${p.badge ? `<span style="padding:4px 10px;border-radius:50px;background:${badgeColors[p.badge]||'#f59e0b'};color:#fff;font-size:11px;font-weight:700">${p.badge}</span>` : '<span style="color:#ccc;font-size:13px">—</span>'}
      </td>
      <td style="padding:14px 16px;text-align:center">
        <div style="display:flex;gap:8px;justify-content:center">
          <button onclick="openEditProduct(${p.id})" style="padding:7px 16px;border-radius:50px;background:#e8f3fb;color:#0a5c8a;border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px">
            <i class="fas fa-edit"></i> تعديل
          </button>
          <button onclick="openDeleteConfirm(${p.id})" style="padding:7px 16px;border-radius:50px;background:#fff5f5;color:#e53e3e;border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px">
            <i class="fas fa-trash-alt"></i> حذف
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Add / Edit Product
// =====================
// IMAGE HANDLING
// =====================
var CLOUDINARY_CLOUD_NAME = 'dssbu3ooo';
var CLOUDINARY_UPLOAD_PRESET = 'dentapro_products'; // ⚠️ لازم تنشئه بنفسك في لوحة Cloudinary (تفاصيل بالأسفل)
var CLOUDINARY_MAX_SIZE_MB = 5;

// يحوّل رابط Cloudinary العادي إلى رابط محسّن (ضغط تلقائي + صيغة تلقائية + تحديد عرض)
function cldOptimize(url, width) {
  if (!url || typeof url !== 'string' || !url.includes('/upload/')) return url;
  const w = width ? `,w_${width}` : '';
  return url.replace('/upload/', `/upload/f_auto,q_auto${w}/`);
}

// ضغط الصورة تلقائياً (تصغير الأبعاد + إعادة ترميز JPEG) قبل رفعها — لا يشمل GIF لتفادي فقدان الحركة
function compressImageFile(file, maxDimension = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    if (file.type === 'image/gif') { resolve(file); return; }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob || blob.size >= file.size) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

async function uploadToCloudinary(file, folder = 'dentapro_products') {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('نوع الملف غير مسموح، يجب أن يكون صورة');
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('صيغة الصورة غير مدعومة، يُسمح فقط بـ JPG, PNG, WEBP, GIF');
  }
  if (file.size > CLOUDINARY_MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`حجم الصورة كبير جداً، الحد الأقصى ${CLOUDINARY_MAX_SIZE_MB} ميجابايت`);
  }

  let uploadFile = file;
  try {
    uploadFile = await compressImageFile(file);
  } catch(e) {
    console.warn('⚠️ فشل ضغط الصورة، سيتم رفعها كما هي:', e.message);
  }

  const formData = new FormData();
  formData.append('file', uploadFile);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Cloudinary upload failed');
  const data = await res.json();
  return data.secure_url;
}

var currentProductImage = null;

function triggerImgUpload() {
  document.getElementById('pImageFile').click();
}

async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('❌ حجم الصورة يتجاوز 2MB', 'error');
    return;
  }

  const preview = document.getElementById('imgPreviewBox');
  const area    = document.getElementById('imgUploadArea');
  const removeBtn = document.getElementById('removeImgBtn');

  area.querySelector('.img-upload-icon').style.display = 'block';
  area.querySelector('.img-upload-text').textContent = '⏳ جاري رفع الصورة...';
  area.querySelector('.img-upload-hint').textContent = '';

  try {
    const url = await uploadToCloudinary(file);
    currentProductImage = url;
    preview.src = url;
    preview.classList.add('show');
    area.classList.add('has-image');
    area.querySelector('.img-upload-icon').style.display = 'none';
    area.querySelector('.img-upload-text').textContent = '✅ تم تحميل الصورة';
    area.querySelector('.img-upload-hint').textContent = file.name;
    removeBtn.style.display = 'inline-flex';
  } catch (e) {
    console.error(e);
    showToast('❌ فشل رفع الصورة، تحقق من الاتصال', 'error');
    area.querySelector('.img-upload-text').textContent = 'انقر لاختيار صورة';
    area.querySelector('.img-upload-hint').textContent = 'PNG، JPG، WEBP — بحد أقصى 2MB';
  }
}

function removeProductImage() {
  currentProductImage = null;
  const preview   = document.getElementById('imgPreviewBox');
  const area      = document.getElementById('imgUploadArea');
  const removeBtn = document.getElementById('removeImgBtn');
  const fileInput = document.getElementById('pImageFile');
  preview.src = '';
  preview.classList.remove('show');
  area.classList.remove('has-image');
  area.querySelector('.img-upload-icon').style.display = 'block';
  area.querySelector('.img-upload-text').textContent = 'انقر لاختيار صورة';
  area.querySelector('.img-upload-hint').textContent = 'PNG، JPG، WEBP — بحد أقصى 2MB';
  removeBtn.style.display = 'none';
  fileInput.value = '';
}

function resetImageUpload() {
  currentProductImage = null;
  removeProductImage();
}

// ===== صور إضافية للمعرض =====
var currentProductExtraImages = [];

function triggerExtraImgUpload() {
  if (currentProductExtraImages.length >= 4) {
    showToast('⚠️ الحد الأقصى 4 صور إضافية', 'error');
    return;
  }
  document.getElementById('pExtraImageFile').click();
}

async function handleExtraImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (currentProductExtraImages.length >= 4) {
    showToast('⚠️ الحد الأقصى 4 صور إضافية', 'error');
    event.target.value = '';
    return;
  }
  showToast('⏳ جاري رفع الصورة...', '');
  try {
    const url = await uploadToCloudinary(file);
    currentProductExtraImages.push(url);
    renderExtraImagesGrid();
  } catch(e) {
    showToast('❌ فشل رفع الصورة: ' + e.message, 'error');
  }
  event.target.value = '';
}

function removeExtraImage(idx) {
  currentProductExtraImages.splice(idx, 1);
  renderExtraImagesGrid();
}

function renderExtraImagesGrid() {
  const grid = document.getElementById('extraImagesGrid');
  const uploadArea = document.getElementById('extraImgUploadArea');
  if (!grid) return;
  grid.innerHTML = currentProductExtraImages.map((url, idx) => `
    <div class="extra-img-thumb">
      <img src="${cldOptimize(url,150)}" loading="lazy">
      <button type="button" class="remove-extra-btn" onclick="removeExtraImage(${idx})"><i class="fas fa-times"></i></button>
    </div>`).join('');
  if (uploadArea) uploadArea.style.display = currentProductExtraImages.length >= 4 ? 'none' : 'block';
}

function loadExtraImages(images) {
  currentProductExtraImages = Array.isArray(images) ? [...images] : [];
  renderExtraImagesGrid();
}

function resetExtraImages() {
  currentProductExtraImages = [];
  renderExtraImagesGrid();
}
// ===== صورة القسم =====
var currentCategoryImage = null;

function triggerCatImgUpload() {
  document.getElementById('catImageFile').click();
}

async function handleCatImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('❌ حجم الصورة يتجاوز 2MB', 'error');
    return;
  }

  const preview = document.getElementById('catImgPreviewBox');
  const area    = document.getElementById('catImgUploadArea');
  const removeBtn = document.getElementById('removeCatImgBtn');

  area.querySelector('.img-upload-icon').style.display = 'block';
  area.querySelector('.img-upload-text').textContent = '⏳ جاري رفع الصورة...';
  area.querySelector('.img-upload-hint').textContent = '';

  try {
    const url = await uploadToCloudinary(file);
    currentCategoryImage = url;
    preview.src = url;
    preview.classList.add('show');
    area.classList.add('has-image');
    area.querySelector('.img-upload-icon').style.display = 'none';
    area.querySelector('.img-upload-text').textContent = '✅ تم تحميل الصورة';
    area.querySelector('.img-upload-hint').textContent = file.name;
    removeBtn.style.display = 'inline-flex';
  } catch (e) {
    console.error(e);
    showToast('❌ فشل رفع الصورة، تحقق من الاتصال', 'error');
    area.querySelector('.img-upload-text').textContent = 'انقر لاختيار صورة';
    area.querySelector('.img-upload-hint').textContent = 'PNG، JPG، WEBP — بحد أقصى 2MB';
  }
}

function removeCategoryImage() {
  currentCategoryImage = null;
  const preview   = document.getElementById('catImgPreviewBox');
  const area      = document.getElementById('catImgUploadArea');
  const removeBtn = document.getElementById('removeCatImgBtn');
  const fileInput = document.getElementById('catImageFile');
  preview.src = '';
  preview.classList.remove('show');
  area.classList.remove('has-image');
  area.querySelector('.img-upload-icon').style.display = 'block';
  area.querySelector('.img-upload-text').textContent = 'انقر لاختيار صورة';
  area.querySelector('.img-upload-hint').textContent = 'PNG، JPG، WEBP — بحد أقصى 2MB';
  removeBtn.style.display = 'none';
  fileInput.value = '';
}

function resetCatImageUpload() {
  currentCategoryImage = null;
  removeCategoryImage();
}

function loadCatImagePreview(imageUrl) {
  if (!imageUrl) { resetCatImageUpload(); return; }
  currentCategoryImage = imageUrl;
  const preview   = document.getElementById('catImgPreviewBox');
  const area      = document.getElementById('catImgUploadArea');
  const removeBtn = document.getElementById('removeCatImgBtn');
  preview.src = imageUrl;
  preview.classList.add('show');
  area.classList.add('has-image');
  area.querySelector('.img-upload-icon').style.display = 'none';
  area.querySelector('.img-upload-text').textContent = '✅ صورة محفوظة';
  area.querySelector('.img-upload-hint').textContent = 'انقر لتغييرها';
  removeBtn.style.display = 'inline-flex';
}
function loadImagePreview(imageUrl) {
  if (!imageUrl) { resetImageUpload(); return; }
  currentProductImage = imageUrl;
  const preview   = document.getElementById('imgPreviewBox');
  const area      = document.getElementById('imgUploadArea');
  const removeBtn = document.getElementById('removeImgBtn');
  preview.src = imageUrl;
  preview.classList.add('show');
  area.classList.add('has-image');
  area.querySelector('.img-upload-icon').style.display = 'none';
  area.querySelector('.img-upload-text').textContent = '✅ صورة محفوظة';
  area.querySelector('.img-upload-hint').textContent = 'انقر لتغييرها';
  removeBtn.style.display = 'inline-flex';
}
function openAddProduct() {
  editingProductId = null;
  document.getElementById('productFormTitle').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة منتج جديد';
  ['pAr','pEn','pDescAr','pDescEn','pBrand','pPrice','pOldPrice','pUnitQty'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pCat').value = 'dev';
  document.getElementById('pUnit').value = 'قطعة';
  document.getElementById('pBadge').value = '';
  document.getElementById('pCountry').value = '';
  document.getElementById('pPoints').value = 0;
  document.getElementById('pPointsManual').checked = true;
  document.getElementById('pPoints').disabled = false;
  document.getElementById('pStock').value = '';
  document.getElementById('productFormError').style.display = 'none';
  resetImageUpload();
  resetExtraImages();
  document.getElementById('productFormModal').classList.add('open');
}

function openEditProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  document.getElementById('productFormTitle').innerHTML = '<i class="fas fa-edit"></i> تعديل المنتج';
  document.getElementById('pAr').value = p.ar;
  document.getElementById('pEn').value = p.en;
  document.getElementById('pDescAr').value = p.desc_ar;
  document.getElementById('pDescEn').value = p.desc_en;
  document.getElementById('pBrand').value = p.brand;
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pOldPrice').value = p.old || '';
  document.getElementById('pCat').value = p.cat;
  document.getElementById('pUnitQty').value = p.unitQty || '';
  document.getElementById('pUnit').value = p.unit || 'قطعة';
  document.getElementById('pBadge').value = p.badge || '';
  document.getElementById('pCountry').value = p.country || '';
  document.getElementById('pPoints').value = p.points || 0;
  document.getElementById('pPointsManual').checked = p.manualPoints !== false;
  document.getElementById('pPoints').disabled = p.manualPoints === false;
  document.getElementById('pStock').value = (p.stock !== undefined && p.stock !== null) ? p.stock : '';
  document.getElementById('productFormError').style.display = 'none';
  loadImagePreview(p.image || null);
  loadExtraImages(p.images || []);
  document.getElementById('productFormModal').classList.add('open');
}

function closeProductForm() {
  document.getElementById('productFormModal').classList.remove('open');
}

async function saveProduct() {
  const ar = document.getElementById('pAr').value.trim();
  const en = document.getElementById('pEn').value.trim();
  const brand = document.getElementById('pBrand').value.trim();
  const price = parseFloat(document.getElementById('pPrice').value);

  if (!ar || !en || !brand || !price) {
    document.getElementById('productFormError').style.display = 'block';
    return;
  }
  document.getElementById('productFormError').style.display = 'none';

  const oldPrice = parseFloat(document.getElementById('pOldPrice').value) || null;
  const unit = document.getElementById('pUnit').value || 'قطعة';
  const unitQty = document.getElementById('pUnitQty').value.trim() || '';
  const productData = {
    cat: document.getElementById('pCat').value,
    brand, ar, en,
    price, old: oldPrice, unit, unitQty,
    desc_ar: document.getElementById('pDescAr').value.trim() || ar,
    desc_en: document.getElementById('pDescEn').value.trim() || en,
    badge:   document.getElementById('pBadge').value || null,
    country: document.getElementById('pCountry').value.trim() || '',
    image:   currentProductImage || null,
    images:  currentProductExtraImages.slice(),
    points:  parseInt(document.getElementById('pPoints').value) || 0,
    stock:   document.getElementById('pStock').value === '' ? null : parseInt(document.getElementById('pStock').value),
  };
  if (!editingProductId) {
    productData.icon = '📦'; // أيقونة افتراضية للمنتجات الجديدة فقط (تُستخدم إن لم تُرفع صورة)
    productData.createdAt = new Date().toISOString();
  }

  let savedProduct;
  if (editingProductId) {
    const idx = products.findIndex(x => x.id === editingProductId);
    if (idx !== -1) products[idx] = { ...products[idx], ...productData };
    savedProduct = products[idx];
    showToast('✅ تم تعديل المنتج بنجاح', 'success');
  } else {
    const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
    savedProduct = { id: newId, ...productData };
    products.push(savedProduct);
    showToast('✅ تم إضافة المنتج بنجاح', 'success');
    createNotification({
      scope: 'broadcast',
      icon: '🆕',
      title: 'منتج جديد في DentaPro',
      message: `${ar} — ${price.toLocaleString()} د.أ`,
      link: `product:${newId}`,
    });
  }

  cacheProductsLocally();
  closeProductForm();
  updateAdminStats();
  renderAdminTable();
  renderProducts();
  renderCategories();
  await saveProductToFirebase(savedProduct);
}

// Delete Product
function openDeleteConfirm(id) {
  deleteTargetId = id;
  const p = products.find(x => x.id === id);
  document.getElementById('deleteProductName').textContent = p ? `${p.icon || ''} ${p.ar || ''}` : '';
  document.getElementById('deleteConfirmModal').classList.add('open');
}
function closeDeleteConfirm() {
  document.getElementById('deleteConfirmModal').classList.remove('open');
  deleteTargetId = null;
}
async function confirmDelete() {
  if (!deleteTargetId) return;
  const p = products.find(x => x.id === deleteTargetId);
  const idx = products.findIndex(x => x.id === deleteTargetId);
  if (idx !== -1) products.splice(idx, 1);
  cart = cart.filter(x => x.id !== deleteTargetId);

  // تنظيف العروض المرتبطة بالمنتج المحذوف
  offers = offers.filter(o => !(o.type === 'qty' && o.productId === deleteTargetId));
  offers.forEach(o => {
    if (o.type === 'bundle' && o.items) {
      o.items = o.items.filter(it => it.productId !== deleteTargetId);
      if (!o.items.length) o.active = false;
    }
  });
  saveOffers();

  cacheProductsLocally();
  const deletedId = deleteTargetId;
  closeDeleteConfirm();
  updateAdminStats();
  renderAdminTable();
  renderProducts();
  renderCategories();
  renderOffers();
  initOffersTicker();
  updateCartUI();
  showToast(`🗑️ تم حذف "${p?.ar}" بنجاح`, 'success');
  await deleteProductFromFirebase(deletedId);
}
// =====================
// POINTS SYSTEM
// =====================

// جلب نقاط عميل معين
async function getClientPoints(uid) {
  if (!uid) return 0;
  // قراءة محلية فورية كقيمة مبدئية
  const localSaved = JSON.parse(localStorage.getItem('dentapro_points') || '{}');
  const localBalance = localSaved[uid] || 0;

  try {
    for (let i = 0; i < 20; i++) {
      if (window._fbDoc2 && window._fbGetDoc) break;
      await new Promise(r => setTimeout(r, 200));
    }
    const ref = window._fbDoc2('points', uid);
    const snap = await window._fbGetDoc(ref);
    if (snap.exists()) {
      const balance = snap.data().balance || 0;
      localSaved[uid] = balance;
      localStorage.setItem('dentapro_points', JSON.stringify(localSaved));
      return balance;
    }
    return localBalance;
  } catch(e) {
    console.warn('❌ خطأ Firebase points:', e.message);
    return localBalance;
  }
}

// حفظ نقاط عميل
async function saveClientPoints(uid, email, balance, log) {
  if (!uid) { console.warn('saveClientPoints: uid مفقود'); return; }
  // حفظ محلي فوري دائماً
  const saved = JSON.parse(localStorage.getItem('dentapro_points') || '{}');
  saved[uid] = balance;
  localStorage.setItem('dentapro_points', JSON.stringify(saved));

  // حفظ في Firebase
  try {
    for (let i = 0; i < 15; i++) {
      if (window._fbDoc2 && window._fbGetDoc && window._fbSetDoc) break;
      await new Promise(r => setTimeout(r, 200));
    }
    const ref = window._fbDoc2('points', uid);
    const snap = await window._fbGetDoc(ref);
    const logs = snap.exists() ? (snap.data().logs || []) : [];
    logs.unshift(log);
    await window._fbSetDoc(ref, { email, uid, balance, logs });
    console.log('✅ تم حفظ النقاط في Firebase:', email, balance);
  } catch(e) {
    console.warn('⚠️ Firebase فشل، محفوظ محلياً فقط:', e.message);
  }
}

// عرض رصيد النقاط في الهيدر
async function renderPointsInHeader() {
  if (!currentUser || currentUser.role !== 'client') return;
  const balance = await getClientPoints(currentUser.uid);
  currentUser.points = balance;
  const chip = document.querySelector('.user-chip-role');
  if (chip) {
    chip.innerHTML = `عميل &nbsp;|&nbsp; <span style="color:#d97706;font-weight:800">🏆 ${balance} نقطة</span>`;
  }
  const headerBadge = document.getElementById('headerPointsBadge');
  if (headerBadge) {
    headerBadge.textContent = balance.toLocaleString();
    headerBadge.style.display = 'inline';
  }
  const fabPointsBtn = document.getElementById('fabPointsBtn');
  const fabPointsLabel = document.getElementById('fabPointsLabel');
  if (fabPointsBtn && fabPointsLabel) {
    fabPointsLabel.textContent = balance.toLocaleString() + ' نقطة';
    fabPointsBtn.style.display = 'flex';
  }

  // إظهار بطاقة النقاط في صفحة طلباتي
  const existing = document.getElementById('clientPointsCard');
  if (existing) { existing.remove(); }

  const ordersPage = document.getElementById('ordersPage');
  if (!ordersPage || !ordersPage.classList.contains('active')) return;

  const card = document.createElement('div');
  card.id = 'clientPointsCard';
  card.style.cssText = `
    background: linear-gradient(135deg, #fffbeb, #fef3c7);
    border: 2px solid #f59e0b;
    border-radius: 18px;
    padding: 22px 28px;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    box-shadow: 0 4px 16px rgba(245,158,11,0.15);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px">
      <div style="width:56px;height:56px;border-radius:50%;
                  background:linear-gradient(135deg,#f59e0b,#d97706);
                  display:flex;align-items:center;justify-content:center;
                  font-size:26px;box-shadow:0 4px 12px rgba(245,158,11,0.35)">🏆</div>
      <div>
        <div style="font-size:13px;color:#92400e;font-weight:600;margin-bottom:4px">رصيد نقاطك الحالي</div>
        <div style="font-size:30px;font-weight:900;color:#d97706;line-height:1">${balance} <span style="font-size:15px;font-weight:600">نقطة</span></div>
      </div>
    </div>
    <div style="text-align:center">
      <div style="font-size:12px;color:#92400e;font-weight:600;margin-bottom:6px">يمكنك استخدام نقاطك عند الشراء</div>
      <button onclick="showPage('home')" class="btn-primary" style="padding:10px 24px;font-size:13px">
        <i class="fas fa-shopping-cart"></i> تسوّق الآن
      </button>
    </div>
  `;

  const ordersInner = ordersPage.querySelector('.orders-page');
  const firstChild  = ordersInner?.querySelector('[style*="display:flex"]');
  if (firstChild) {
    ordersInner.insertBefore(card, firstChild.nextSibling);
  } else if (ordersInner) {
    ordersInner.appendChild(card);
  }
}

// ── ADMIN: عرض قائمة العملاء ونقاطهم ──
async function renderAdminPoints() {
  const container = document.getElementById('adminPointsList');
  container.innerHTML = `
    <div style="text-align:center;padding:32px;color:var(--text-muted)">
      <div class="spinner" style="margin:0 auto 12px;width:28px;height:28px;border-width:4px"></div>
      جاري تحميل العملاء...
    </div>`;
  try {
    // جلب العملاء من Firestore مباشرة
    for (let i = 0; i < 20; i++) {
      if (window._fbCollection && window._fbGetDocs) break;
      await new Promise(r => setTimeout(r, 300));
    }
    const usersSnap = await window._fbGetDocs(window._fbCollection(window._db, 'users'));
    let users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.role === 'client');

    // دمج مع localStorage للمستخدمين القدامى
    const localUsers = JSON.parse(localStorage.getItem('dentapro_users') || '[]');
    localUsers.forEach(lu => {
      if (!users.find(u => u.email === lu.email)) users.push(lu);
    });

    if (!users.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:48px;color:var(--text-muted)">
          <i class="fas fa-users" style="font-size:48px;opacity:0.2;display:block;margin-bottom:16px"></i>
          <h3 style="font-weight:800;margin-bottom:8px">لا يوجد عملاء مسجلون بعد</h3>
        </div>`;
      return;
    }

    // جلب الطلبات لحساب إجمالي المشتريات
    const ordersSnap = await window._fbGetDocs(window._fbOrdersRef());
    const allOrders  = ordersSnap.docs.map(d => d.data());

    const usersWithData = await Promise.all(users.map(async u => {
      const balance    = await getClientPoints(u.uid);
      const userOrders = allOrders.filter(o => o.clientEmail === u.email);
      const totalSpent = userOrders.reduce((s, o) => s + (o.total || 0), 0);
      return { ...u, balance, orderCount: userOrders.length, totalSpent };
    }));

    container.innerHTML = usersWithData.map(u => `
      <div class="points-admin-card">
        <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));
            display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:800;flex-shrink:0">
            ${(u.firstName||u.name||'؟').charAt(0)}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:14px;color:var(--primary-dark)">${escHtml(u.firstName || u.name || 'عميل')}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${escHtml(u.clinic || '')} · ${escHtml(u.email)}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;align-items:center">
              <span class="points-badge"><i class="fas fa-star"></i> ${u.balance} نقطة</span>
              <span style="font-size:12px;color:var(--text-muted)">
                <i class="fas fa-shopping-bag" style="color:var(--primary-light)"></i> ${u.orderCount} طلب
              </span>
              <span style="font-size:12px;font-weight:800;color:var(--primary)">
                ${u.totalSpent.toLocaleString()} د.أ
              </span>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button onclick="showClientRecord('${escJsAttr(u.uid)}','${escJsAttr(u.email)}')"
            style="padding:8px 16px;border-radius:50px;background:#e8f3fb;color:var(--primary);
            border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;
            display:flex;align-items:center;gap:5px">
            <i class="fas fa-folder-open"></i> السجل
          </button>
          <button class="add-points-btn" onclick="openAddPointsModal('${escJsAttr(u.uid)}','${escJsAttr(u.email)}','${escJsAttr(u.firstName||u.name||'عميل')}','${escJsAttr(u.clinic||'')}',${u.balance},'add')">
            <i class="fas fa-plus"></i> نقاط
          </button>
          <button class="add-points-btn" style="background:linear-gradient(135deg,#e53e3e,#c53030);box-shadow:0 2px 8px rgba(229,62,62,0.3)"
            onclick="openAddPointsModal('${escJsAttr(u.uid)}','${escJsAttr(u.email)}','${escJsAttr(u.firstName||u.name||'عميل')}','${escJsAttr(u.clinic||'')}',${u.balance},'deduct')">
            <i class="fas fa-minus"></i>
          </button>
        </div>
      </div>
    `).join('');

  } catch(e) {
    console.error(e);
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--danger)">خطأ في تحميل البيانات: ${e.message}</div>`;
  }
}

// =====================
// ADMIN: OFFERS MANAGEMENT
// =====================
function renderAdminOffers() {
  const container = document.getElementById('adminOffersList');
  if (!offers.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-muted)">
      <i class="fas fa-gift" style="font-size:48px;opacity:0.2;display:block;margin-bottom:16px"></i>
      لا توجد عروض حالياً</div>`;
    return;
  }
  container.innerHTML = offers.map(o => {
    if (o.type === 'text') {
      return `
      <div class="points-admin-card">
        <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
          <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#f3e8ff,#e9d5ff);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">📢</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:14px;color:var(--primary-dark)">${escHtml(o.text)}</div>
            <div style="margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span style="font-size:11px;font-weight:800;color:${o.active?'#15803d':'#94a3b8'}">${o.active?'● فعّال':'○ متوقف'}</span>
              ${o.expiresAt ? `<span class="offer-countdown-badge mini" style="margin:0"><i class="fas fa-hourglass-half"></i> <span class="offer-countdown" data-expires="${o.expiresAt}">${formatCountdown(o.expiresAt)||''}</span></span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="toggleOfferActive(${o.id})" style="padding:7px 14px;border-radius:50px;background:#f8fbfd;color:var(--text-muted);border:1.5px solid var(--border);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer"><i class="fas fa-power-off"></i></button>
          <button onclick="openAddTextOffer(${o.id})" style="padding:7px 14px;border-radius:50px;background:#e8f3fb;color:var(--primary);border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer"><i class="fas fa-edit"></i></button>
          <button onclick="deleteOffer(${o.id})" style="padding:7px 14px;border-radius:50px;background:#fff5f5;color:var(--danger);border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`;
    } else if (o.type === 'qty') {
      const p = products.find(x => x.id === o.productId);
      const tiersHtml = (o.tiers || []).map(tr =>
        `<span style="background:#f0f8ff;border-radius:50px;padding:3px 10px;font-size:12px;font-weight:700;color:var(--primary);margin-left:4px">${tr.qty}× = ${tr.price} د.أ</span>`
      ).join('');
      return `
      <div class="points-admin-card">
        <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
          <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#f0f8ff,#e8f3fb);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${p?p.icon:'🏷️'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:14px;color:var(--primary-dark)">🏷️ ${p?p.ar:'منتج محذوف'}</div>
            <div style="margin-top:6px">${tiersHtml}</div>
            <div style="margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span style="font-size:11px;font-weight:800;color:${o.active?'#15803d':'#94a3b8'}">${o.active?'● فعّال':'○ متوقف'}</span>
              ${o.expiresAt ? `<span class="offer-countdown-badge mini" style="margin:0"><i class="fas fa-hourglass-half"></i> <span class="offer-countdown" data-expires="${o.expiresAt}">${formatCountdown(o.expiresAt)||''}</span></span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="toggleOfferActive(${o.id})" style="padding:7px 14px;border-radius:50px;background:#f8fbfd;color:var(--text-muted);border:1.5px solid var(--border);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer"><i class="fas fa-power-off"></i></button>
          <button onclick="openEditQtyOffer(${o.id})" style="padding:7px 14px;border-radius:50px;background:#e8f3fb;color:var(--primary);border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer"><i class="fas fa-edit"></i></button>
          <button onclick="deleteOffer(${o.id})" style="padding:7px 14px;border-radius:50px;background:#fff5f5;color:var(--danger);border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`;
    } else {
      const original = getBundleOriginalPrice(o);
      const itemsDetailHtml = (o.items || []).map(it => {
        const ip = products.find(x => x.id === it.productId);
        return ip ? `<span style="background:#f0f8ff;border-radius:50px;padding:2px 10px;font-size:11px;font-weight:700;color:var(--primary);margin-left:4px;display:inline-block;margin-top:4px">${ip.ar} × ${it.qty}</span>` : '';
      }).join('');
      return `
      <div class="points-admin-card">
        <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
          <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#fffbeb,#fef3c7);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden">
            ${o.image?`<img src="${escHtml(cldOptimize(o.image,80))}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`:escHtml(o.icon||'🎁')}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:14px;color:var(--primary-dark)">🎁 ${escHtml(o.name_ar)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${original.toLocaleString()} ← ${o.bundlePrice.toLocaleString()} د.أ</div>
            <div style="margin-top:4px">${itemsDetailHtml}</div>
            <div style="margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span style="font-size:11px;font-weight:800;color:${o.active?'#15803d':'#94a3b8'}">${o.active?'● فعّال':'○ متوقف'}</span>
              ${o.expiresAt ? `<span class="offer-countdown-badge mini" style="margin:0"><i class="fas fa-hourglass-half"></i> <span class="offer-countdown" data-expires="${o.expiresAt}">${formatCountdown(o.expiresAt)||''}</span></span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="toggleOfferActive(${o.id})" style="padding:7px 14px;border-radius:50px;background:#f8fbfd;color:var(--text-muted);border:1.5px solid var(--border);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer"><i class="fas fa-power-off"></i></button>
          <button onclick="openEditBundle(${o.id})" style="padding:7px 14px;border-radius:50px;background:#e8f3fb;color:var(--primary);border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer"><i class="fas fa-edit"></i></button>
          <button onclick="deleteOffer(${o.id})" style="padding:7px 14px;border-radius:50px;background:#fff5f5;color:var(--danger);border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`;
    }
  }).join('');
}

function openAddTextOffer(id) {
  document.getElementById('textOfferId').value = id || '';
  document.getElementById('textOfferText').value = '';
  document.getElementById('textOfferTextEn').value = '';
  document.getElementById('textOfferExpiry').value = '';
  document.getElementById('textOfferShowBanner').checked = false;
  document.getElementById('textOfferError').style.display = 'none';
  removeTextOfferImage();
  if (id) {
    const o = offers.find(x => x.id === id);
    if (o) {
      document.getElementById('textOfferText').value = o.text || '';
      document.getElementById('textOfferTextEn').value = o.textEn || '';
      if (o.expiresAt) document.getElementById('textOfferExpiry').value = toDatetimeLocalValue(o.expiresAt);
      document.getElementById('textOfferShowBanner').checked = !!o.showInBanner;
      if (o.image) loadTextOfferImagePreview(o.image);
    }
  }
  document.getElementById('textOfferModal').classList.add('open');
}
function closeTextOfferModal() {
  document.getElementById('textOfferModal').classList.remove('open');
}
function saveTextOffer() {
  const text = document.getElementById('textOfferText').value.trim();
  const textEn = document.getElementById('textOfferTextEn').value.trim();
  if (!text) {
    document.getElementById('textOfferError').style.display = 'flex';
    return;
  }
  const editId = parseInt(document.getElementById('textOfferId').value) || null;
  const expiryVal = document.getElementById('textOfferExpiry').value;
  const expiresAt = normalizeOfferExpiry(expiryVal);

  const showInBanner = document.getElementById('textOfferShowBanner').checked;
  if (editId) {
    const o = offers.find(x => x.id === editId);
    if (o) { o.text = text; o.textEn = textEn; o.expiresAt = expiresAt; o.showInBanner = showInBanner; o.image = currentTextOfferImage; }
  } else {
    const newId = offers.length ? Math.max(...offers.map(o => o.id)) + 1 : 1;
    offers.push({ id: newId, type: 'text', text, textEn, expiresAt, showInBanner, image: currentTextOfferImage, active: true, createdAt: new Date().toISOString() });
  }
  saveOffers();
  renderAdminOffers();
  initOffersTicker();
  closeTextOfferModal();
  showToast('✅ تم حفظ النص الإعلاني', 'success');
}

var currentTextOfferImage = null;
function triggerTextOfferImgUpload() { document.getElementById('textOfferImageFile').click(); }

async function handleTextOfferImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('❌ حجم الصورة يتجاوز 2MB', 'error'); return; }
  const preview = document.getElementById('textOfferImgPreviewBox');
  const area = document.getElementById('textOfferImgUploadArea');
  const removeBtn = document.getElementById('removeTextOfferImgBtn');
  area.querySelector('.img-upload-text').textContent = '⏳ جاري رفع الصورة...';
  try {
    const url = await uploadToCloudinary(file);
    currentTextOfferImage = url;
    preview.src = url; preview.classList.add('show');
    area.classList.add('has-image');
    area.querySelector('.img-upload-icon').style.display = 'none';
    area.querySelector('.img-upload-text').textContent = '✅ تم تحميل الصورة';
    area.querySelector('.img-upload-hint').textContent = file.name;
    removeBtn.style.display = 'inline-flex';
  } catch (e) {
    showToast('❌ فشل رفع الصورة، تحقق من الاتصال', 'error');
    area.querySelector('.img-upload-text').textContent = 'انقر لاختيار صورة';
  }
}

function removeTextOfferImage() {
  currentTextOfferImage = null;
  const preview = document.getElementById('textOfferImgPreviewBox');
  const area = document.getElementById('textOfferImgUploadArea');
  const removeBtn = document.getElementById('removeTextOfferImgBtn');
  preview.src = ''; preview.classList.remove('show');
  area.classList.remove('has-image');
  area.querySelector('.img-upload-icon').style.display = 'block';
  area.querySelector('.img-upload-text').textContent = 'انقر لاختيار صورة';
  area.querySelector('.img-upload-hint').textContent = 'PNG، JPG، WEBP — بحد أقصى 2MB';
  removeBtn.style.display = 'none';
  document.getElementById('textOfferImageFile').value = '';
}

function loadTextOfferImagePreview(url) {
  currentTextOfferImage = url;
  const preview = document.getElementById('textOfferImgPreviewBox');
  const area = document.getElementById('textOfferImgUploadArea');
  const removeBtn = document.getElementById('removeTextOfferImgBtn');
  preview.src = url; preview.classList.add('show');
  area.classList.add('has-image');
  area.querySelector('.img-upload-icon').style.display = 'none';
  area.querySelector('.img-upload-text').textContent = '✅ صورة محفوظة';
  area.querySelector('.img-upload-hint').textContent = 'انقر لتغييرها';
  removeBtn.style.display = 'inline-flex';
}

function toggleOfferActive(id) {
  const o = offers.find(x => x.id === id);
  if (!o) return;
  o.active = !o.active;
  saveOffers();
  renderAdminOffers();
  renderOffers();
  renderProducts();
  initOffersTicker();
  showToast(o.active ? '✅ تم تفعيل العرض' : '⏸️ تم إيقاف العرض', 'success');
}

function deleteOffer(id) {
  if (!confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
  offers = offers.filter(x => x.id !== id);
  saveOffers();
  renderAdminOffers();
  renderOffers();
  renderProducts();
  initOffersTicker();
  showToast('🗑️ تم حذف العرض', 'success');
}

function addTierRow(qty='', price='') {
  const list = document.getElementById('qtyTiersList');
  const row = document.createElement('div');
  row.className = 'tier-row';
  row.innerHTML = `
    <input type="number" class="form-input tier-qty" placeholder="الكمية" min="1" value="${qty}" style="flex:1">
    <input type="number" class="form-input tier-price" placeholder="السعر الإجمالي" min="0" value="${price}" style="flex:1">
    <button type="button" onclick="this.closest('.tier-row').remove()" style="width:38px;height:38px;border-radius:50%;background:#fff5f5;color:var(--danger);border:none;cursor:pointer;flex-shrink:0"><i class="fas fa-times"></i></button>`;
  list.appendChild(row);
}

function openAddQtyOffer() {
  document.getElementById('qtyOfferTitle').innerHTML = '<i class="fas fa-tag"></i> إضافة عرض كمية';
  document.getElementById('qtyOfferId').value = '';
  document.getElementById('qtyOfferError').style.display = 'none';
  document.getElementById('qtyOfferExpiry').value = '';
  document.getElementById('qtyOfferShowBanner').checked = false;
  const sel = document.getElementById('qtyOfferProduct');
  sel.innerHTML = products.map(p => `<option value="${escHtml(p.id)}">${escHtml(p.ar)} — ${escHtml(p.brand)}</option>`).join('');
  document.getElementById('qtyTiersList').innerHTML = '';
  addTierRow(1, '');
  addTierRow('', '');
  document.getElementById('qtyOfferModal').classList.add('open');
}

function openEditQtyOffer(id) {
  const o = offers.find(x => x.id === id);
  if (!o) return;
  openAddQtyOffer();
  document.getElementById('qtyOfferTitle').innerHTML = '<i class="fas fa-edit"></i> تعديل عرض الكمية';
  document.getElementById('qtyOfferId').value = id;
  document.getElementById('qtyOfferProduct').value = o.productId;
  document.getElementById('qtyOfferExpiry').value = toDatetimeLocalValue(o.expiresAt);
  document.getElementById('qtyOfferShowBanner').checked = !!o.showInBanner;
  document.getElementById('qtyTiersList').innerHTML = '';
  (o.tiers || []).forEach(tr => addTierRow(tr.qty, tr.price));
}

function closeQtyOfferModal() {
  document.getElementById('qtyOfferModal').classList.remove('open');
}

var _adBannerInterval = null;
var _adBannerOffers = [];
var _adBannerIndex = 0;

var _adBannerTouchStartX = null;

async function renderAdBanner() {
  const section = document.getElementById('adBannerSection');
  const slide = document.getElementById('adBannerSlide');
  if (!section || !slide) return;

  const bannerQtyOffers = offers.filter(o => o.type === 'qty' && o.active && !isOfferExpired(o) && o.showInBanner);
  const bannerBundles = offers.filter(o => o.type === 'bundle' && o.active && !isOfferExpired(o) && o.showInBanner);
  const bannerTexts = offers.filter(o => o.type === 'text' && o.active && !isOfferExpired(o) && o.showInBanner);

  if (!bannerQtyOffers.length && !bannerBundles.length && !bannerTexts.length) {
    section.style.display = 'none';
    if (_adBannerInterval) { clearInterval(_adBannerInterval); _adBannerInterval = null; }
    return;
  }

  await fetchProductsByIds([
    ...bannerQtyOffers.map(o => o.productId),
    ...bannerBundles.flatMap(o => o.items.map(it => it.productId))
  ]);

  const qtySlides = bannerQtyOffers
    .map(o => ({ kind: 'qty', offer: o, product: products.find(p => p.id === o.productId) }))
    .filter(x => x.product);

  const bundleSlides = bannerBundles
    .map(o => ({
      kind: 'bundle',
      offer: o,
      bundleProducts: o.items.map(it => products.find(p => p.id === it.productId)).filter(Boolean)
    }))
    .filter(x => x.bundleProducts.length);

  const textSlides = bannerTexts.map(o => ({ kind: 'text', offer: o }));

  _adBannerOffers = [...qtySlides, ...bundleSlides, ...textSlides];

  if (!_adBannerOffers.length) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  _adBannerIndex = 0;
  showAdBannerSlide();
  initAdBannerSwipe();
  restartAdBannerAutoplay();
}

function restartAdBannerAutoplay() {
  if (_adBannerInterval) clearInterval(_adBannerInterval);
  if (_adBannerOffers.length > 1) {
    _adBannerInterval = setInterval(() => {
      _adBannerIndex = (_adBannerIndex + 1) % _adBannerOffers.length;
      showAdBannerSlide();
    }, 4500);
  }
}

function adBannerNav(dir) {
  if (!_adBannerOffers.length) return;
  _adBannerIndex = (_adBannerIndex + dir + _adBannerOffers.length) % _adBannerOffers.length;
  showAdBannerSlide();
  restartAdBannerAutoplay();
}

function initAdBannerSwipe() {
  const slide = document.getElementById('adBannerSlide');
  if (!slide || slide.dataset.swipeBound) return;
  slide.dataset.swipeBound = '1';
  slide.addEventListener('touchstart', e => { _adBannerTouchStartX = e.touches[0].clientX; }, { passive: true });
  slide.addEventListener('touchend', e => {
    if (_adBannerTouchStartX === null) return;
    const dx = e.changedTouches[0].clientX - _adBannerTouchStartX;
    _adBannerTouchStartX = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) adBannerNav(1); else adBannerNav(-1);
  }, { passive: true });
}

function showAdBannerSlide() {
  const slide = document.getElementById('adBannerSlide');
  if (!slide || !_adBannerOffers.length) return;
  const current = _adBannerOffers[_adBannerIndex];

  slide.style.opacity = '0';
  setTimeout(() => {
    if (current.kind === 'bundle') {
      renderBannerBundleSlide(slide, current);
    } else if (current.kind === 'text') {
      renderBannerTextSlide(slide, current);
    } else {
      renderBannerQtySlide(slide, current);
    }
    slide.style.opacity = '1';
  }, 200);
}

function renderBannerTextSlide(slide, current) {
  const { offer } = current;
  const text = currentLang === 'en' ? (offer.textEn || offer.text) : offer.text;
  const imgUrl = offer.image ? cldOptimize(offer.image, 700) : '';

  slide.removeAttribute('onclick');
  slide.style.cursor = 'default';

  if (imgUrl) {
    slide.innerHTML = `
      <div style="width:42%;flex-shrink:0;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;padding:12px">
        <img src="${imgUrl}" alt="announcement" loading="lazy" style="width:100%;height:100%;object-fit:contain">
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:0 26px;background:#fff;min-width:0">
        <p style="font-size:19px;font-weight:800;color:var(--primary-dark);line-height:1.5;margin:0">${escHtml(text)}</p>
      </div>`;
  } else {
    slide.innerHTML = `
      <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:0 32px;
        background:linear-gradient(135deg,var(--primary),var(--primary-light))">
        <p style="font-size:22px;font-weight:800;color:#fff;line-height:1.5;margin:0;text-align:center">
          <i class="fas fa-bullhorn" style="margin-left:8px;opacity:0.85"></i>${escHtml(text)}
        </p>
      </div>`;
  }
}

function renderBannerQtySlide(slide, current) {
  const { offer, product: p } = current;
  const bestTier = offer.tiers[offer.tiers.length - 1];
  const unitPrice = bestTier.price / bestTier.qty;
  const discountPct = p.price > 0 ? Math.round((1 - unitPrice / p.price) * 100) : 0;
  const imgUrl = p.image ? cldOptimize(p.image, 500) : '';

  slide.setAttribute('onclick', `openProductDetail(${p.id})`);
  slide.innerHTML = `
    <div style="width:42%;flex-shrink:0;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;padding:12px">
      ${imgUrl ? `<img src="${imgUrl}" alt="offer" loading="lazy" style="width:100%;height:100%;object-fit:contain">` : `<span style="font-size:56px">${escHtml(p.icon || '')}</span>`}
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:10px;padding:0 26px;background:#fff">
      ${discountPct > 0 ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:50px;background:rgba(229,62,62,0.1);color:#e53e3e;font-size:13px;font-weight:800">
        <i class="fas fa-bolt" style="font-size:11px"></i> ${t('خصم','SAVE')} ${discountPct}%
      </span>` : ''}
      <div style="display:flex;align-items:baseline;gap:6px">
        <span style="font-size:36px;font-weight:900;color:#e53e3e;letter-spacing:-0.5px">${unitPrice.toFixed(2)}</span>
        <span style="font-size:16px;font-weight:700;color:#e53e3e">${t('د.أ','JD')}</span>
      </div>
      <span style="font-size:16px;color:var(--text-muted);text-decoration:line-through;font-weight:600">${p.price.toLocaleString()} ${t('د.أ','JD')}</span>
    </div>`;
}

function bundleImageBoxHTML(p, size) {
  const imgUrl = p.image ? cldOptimize(p.image, size * 2) : '';
  return `<div style="width:${size}px;height:${size}px;border-radius:14px;overflow:hidden;flex-shrink:0;background:#fff;display:flex;align-items:center;justify-content:center;padding:4px">
    ${imgUrl ? `<img src="${imgUrl}" alt="${escHtml(p.en)}" loading="lazy" style="width:100%;height:100%;object-fit:contain">` : `<span style="font-size:${Math.round(size*0.4)}px">${escHtml(p.icon || '')}</span>`}
  </div>`;
}

function bundlePlusIconHTML(absolute) {
  const pos = absolute ? 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' : '';
  return `<span style="${pos}color:var(--primary);font-size:32px;font-weight:900;line-height:1;display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:2">+</span>`;
}

function bundleImagesLayoutHTML(products) {
  const list = products.slice(0, 4);

  if (list.length <= 1) {
    return bundleImageBoxHTML(list[0], 100);
  }
  if (list.length === 2) {
    return `<div style="display:flex;align-items:center;gap:10px">
      ${bundleImageBoxHTML(list[0], 84)}
      ${bundlePlusIconHTML(false)}
      ${bundleImageBoxHTML(list[1], 84)}
    </div>`;
  }
  if (list.length === 3) {
    return `<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:6px">
      ${bundleImageBoxHTML(list[0], 68)}
      <div style="display:flex;gap:6px">
        ${bundleImageBoxHTML(list[1], 68)}
        ${bundleImageBoxHTML(list[2], 68)}
      </div>
      ${bundlePlusIconHTML(true)}
    </div>`;
  }
  // 4 منتجات
  return `<div style="position:relative;display:grid;grid-template-columns:repeat(2,1fr);gap:6px">
    ${list.map(p => bundleImageBoxHTML(p, 66)).join('')}
    ${bundlePlusIconHTML(true)}
  </div>`;
}

function renderBannerBundleSlide(slide, current) {
  const { offer, bundleProducts } = current;
  const original = getBundleOriginalPrice(offer);
  const bundlePrice = offer.bundlePrice;
  const discountPct = original > 0 ? Math.round((1 - bundlePrice / original) * 100) : 0;

  slide.setAttribute('onclick', `openBundleDetail(${offer.id})`);
  slide.innerHTML = `
    <div style="width:56%;flex-shrink:0;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;padding:10px">
      ${bundleImagesLayoutHTML(bundleProducts)}
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:8px;padding:0 12px;background:#fff;min-width:0">
      <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:50px;background:rgba(16,185,129,0.1);color:var(--success);font-size:12px;font-weight:800;white-space:nowrap">
        <i class="fas fa-box-open" style="font-size:10px"></i> ${t('باقة','Bundle')}${discountPct > 0 ? ` — ${discountPct}%` : ''}
      </span>
      <div style="display:flex;align-items:baseline;gap:5px">
        <span style="font-size:28px;font-weight:900;color:#e53e3e;letter-spacing:-0.5px">${bundlePrice.toLocaleString()}</span>
        <span style="font-size:14px;font-weight:700;color:#e53e3e">${t('د.أ','JD')}</span>
      </div>
      <span style="font-size:14px;color:var(--text-muted);text-decoration:line-through;font-weight:600">${original.toLocaleString()} ${t('د.أ','JD')}</span>
    </div>`;
}

function saveQtyOffer() {
  const productId = parseInt(document.getElementById('qtyOfferProduct').value);
  const rows = document.querySelectorAll('#qtyTiersList .tier-row');
  const tiers = [];
  rows.forEach(r => {
    const qty = parseInt(r.querySelector('.tier-qty').value);
    const price = parseFloat(r.querySelector('.tier-price').value);
    if (qty > 0 && price > 0) tiers.push({ qty, price });
  });
  tiers.sort((a,b) => a.qty - b.qty);

  const showErr = msg => {
    document.getElementById('qtyOfferErrorMsg').textContent = msg;
    document.getElementById('qtyOfferError').style.display = 'block';
  };
  if (!productId) return showErr('يرجى اختيار منتج');
  if (tiers.length < 1) return showErr('يرجى إضافة مستوى واحد على الأقل بكمية وسعر صحيحين');

  const expiryVal = document.getElementById('qtyOfferExpiry').value;
  if (expiryVal && new Date(expiryVal) <= new Date()) return showErr('تاريخ الانتهاء يجب أن يكون بالمستقبل');
  const expiresAt = expiryVal ? new Date(expiryVal).toISOString() : null;

  const editId = parseInt(document.getElementById('qtyOfferId').value) || null;
  const existingDup = offers.find(o => o.type === 'qty' && o.productId === productId && o.id !== editId);
  if (existingDup) return showErr('يوجد عرض كمية بالفعل لهذا المنتج');

  if (editId) {
    const showInBanner = document.getElementById('qtyOfferShowBanner').checked;
    const idx = offers.findIndex(o => o.id === editId);
    if (idx !== -1) offers[idx] = { ...offers[idx], productId, tiers, expiresAt, showInBanner };
    showToast('✅ تم تعديل عرض الكمية', 'success');
  } else {
    const showInBanner = document.getElementById('qtyOfferShowBanner').checked;
    const newId = offers.length ? Math.max(...offers.map(o => o.id)) + 1 : 1;
    offers.push({ id: newId, type: 'qty', productId, tiers, expiresAt, showInBanner, active: true, createdAt: new Date().toISOString() });
    showToast('✅ تم إضافة عرض الكمية', 'success');
  }
  saveOffers();
  document.getElementById('qtyOfferError').style.display = 'none';
  closeQtyOfferModal();
  renderAdminOffers();
  renderOffers();
  renderProducts();
  initOffersTicker();
  renderAdBanner();
}

var currentBundleItems = [];
var currentBundleImage = null;

function addBundleItemRow() {
  const select = document.getElementById('bundleAddProductSelect');
  const productId = parseInt(select.value);
  const qty = parseInt(document.getElementById('bundleAddProductQty').value) || 1;
  if (!productId) {
    showToast('⚠️ يرجى اختيار مادة أولاً', 'error');
    return;
  }
  const p = products.find(x => x.id === productId);
  const existing = currentBundleItems.find(it => it.productId === productId);
  if (existing) {
    existing.qty = qty;
    showToast(`✏️ تم تحديث كمية "${p ? p.ar : 'المادة'}" إلى ${qty}`, 'success');
  } else {
    currentBundleItems.push({ productId, qty });
    showToast(`✅ تمت إضافة "${p ? p.ar : 'مادة'}" بكمية ${qty}`, 'success');
  }
  document.getElementById('bundleAddProductQty').value = 1;
  // إعادة ضبط القائمة المنسدلة لفرض اختيار صريح للمادة التالية
  select.selectedIndex = 0;
  renderBundleItemsList();
}

function removeBundleItemRow(productId) {
  currentBundleItems = currentBundleItems.filter(it => it.productId !== productId);
  renderBundleItemsList();
}

function renderBundleItemsList() {
  const list = document.getElementById('bundleItemsList');
  if (!currentBundleItems.length) {
    list.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:10px">لم تتم إضافة منتجات بعد</div>`;
  } else {
    list.innerHTML = currentBundleItems.map(it => {
      const p = products.find(x => x.id === it.productId);
      if (!p) return '';
      return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;background:#f8fbfd;border-radius:10px;border:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <span style="font-size:18px;flex-shrink:0">${escHtml(p.icon || '')}</span>
          <span style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(p.ar)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span style="font-size:12px;color:var(--text-muted)">الكمية:</span>
          <input type="number" min="1" value="${it.qty}" style="width:56px;padding:5px 8px;border-radius:8px;border:1.5px solid var(--border);font-family:inherit;font-size:13px;text-align:center"
            onchange="updateBundleItemQty(${it.productId}, this.value)">
        </div>
        <button onclick="removeBundleItemRow(${it.productId})" style="background:none;border:none;color:var(--danger);cursor:pointer;flex-shrink:0"><i class="fas fa-times-circle"></i></button>
      </div>`;
    }).join('');
  }
  updateBundleOriginalPreview();
}

function updateBundleItemQty(productId, newQty) {
  const qty = parseInt(newQty) || 1;
  const item = currentBundleItems.find(it => it.productId === productId);
  if (item) item.qty = qty;
  updateBundleOriginalPreview();
}

function updateBundleOriginalPreview() {
  const total = currentBundleItems.reduce((s, it) => {
    const p = products.find(x => x.id === it.productId);
    return s + (p ? p.price * it.qty : 0);
  }, 0);
  const el = document.getElementById('bundleOriginalPreview');
  if (el) el.textContent = total.toLocaleString() + ' د.أ';
}

function triggerBundleImgUpload() { document.getElementById('bundleImageFile').click(); }

async function handleBundleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('❌ حجم الصورة يتجاوز 2MB', 'error'); return; }
  const preview = document.getElementById('bundleImgPreviewBox');
  const area = document.getElementById('bundleImgUploadArea');
  const removeBtn = document.getElementById('removeBundleImgBtn');
  area.querySelector('.img-upload-text').textContent = '⏳ جاري رفع الصورة...';
  try {
    const url = await uploadToCloudinary(file);
    currentBundleImage = url;
    preview.src = url; preview.classList.add('show');
    area.classList.add('has-image');
    area.querySelector('.img-upload-icon').style.display = 'none';
    area.querySelector('.img-upload-text').textContent = '✅ تم تحميل الصورة';
    area.querySelector('.img-upload-hint').textContent = file.name;
    removeBtn.style.display = 'inline-flex';
  } catch (e) {
    showToast('❌ فشل رفع الصورة، تحقق من الاتصال', 'error');
    area.querySelector('.img-upload-text').textContent = 'انقر لاختيار صورة';
  }
}

function removeBundleImage() {
  currentBundleImage = null;
  const preview = document.getElementById('bundleImgPreviewBox');
  const area = document.getElementById('bundleImgUploadArea');
  const removeBtn = document.getElementById('removeBundleImgBtn');
  preview.src = ''; preview.classList.remove('show');
  area.classList.remove('has-image');
  area.querySelector('.img-upload-icon').style.display = 'block';
  area.querySelector('.img-upload-text').textContent = 'انقر لاختيار صورة';
  area.querySelector('.img-upload-hint').textContent = 'PNG، JPG، WEBP — بحد أقصى 2MB';
  removeBtn.style.display = 'none';
  document.getElementById('bundleImageFile').value = '';
}

function loadBundleImagePreview(url) {
  currentBundleImage = url;
  const preview = document.getElementById('bundleImgPreviewBox');
  const area = document.getElementById('bundleImgUploadArea');
  const removeBtn = document.getElementById('removeBundleImgBtn');
  preview.src = url; preview.classList.add('show');
  area.classList.add('has-image');
  area.querySelector('.img-upload-icon').style.display = 'none';
  area.querySelector('.img-upload-text').textContent = '✅ صورة محفوظة';
  area.querySelector('.img-upload-hint').textContent = 'انقر لتغييرها';
  removeBtn.style.display = 'inline-flex';
}

function openAddBundle() {
  document.getElementById('bundleModalTitle').innerHTML = '<i class="fas fa-gift"></i> إضافة باقة جديدة';
  document.getElementById('bundleId').value = '';
  document.getElementById('bundleExpiry').value = '';
  document.getElementById('bundleShowBanner').checked = false;
  ['bundleNameAr','bundleNameEn','bundleDescAr','bundleDescEn','bundlePrice','bundlePoints'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('bundleError').style.display = 'none';
  currentBundleItems = [];
  removeBundleImage();
  const sel = document.getElementById('bundleAddProductSelect');
  sel.innerHTML = `<option value="">— اختر مادة —</option>` +
    products.map(p => `<option value="${escHtml(p.id)}">${escHtml(p.ar)} (${p.price.toLocaleString()} د.أ)</option>`).join('');
  document.getElementById('bundleAddProductQty').value = 1;
  renderBundleItemsList();
  document.getElementById('bundleModal').classList.add('open');
}

function openEditBundle(id) {
  const o = offers.find(x => x.id === id && x.type === 'bundle');
  if (!o) return;
  openAddBundle();
  document.getElementById('bundleModalTitle').innerHTML = '<i class="fas fa-edit"></i> تعديل الباقة';
  document.getElementById('bundleId').value = id;
  document.getElementById('bundleNameAr').value = o.name_ar;
  document.getElementById('bundleNameEn').value = o.name_en;
  document.getElementById('bundleDescAr').value = o.desc_ar || '';
  document.getElementById('bundleDescEn').value = o.desc_en || '';
  document.getElementById('bundlePrice').value = o.bundlePrice;
  document.getElementById('bundlePoints').value = o.points || '';
  document.getElementById('bundleExpiry').value = toDatetimeLocalValue(o.expiresAt);
  document.getElementById('bundleShowBanner').checked = !!o.showInBanner;
  currentBundleItems = (o.items || []).map(it => ({...it}));
  if (o.image) loadBundleImagePreview(o.image);
  renderBundleItemsList();
}

function closeBundleModal() { document.getElementById('bundleModal').classList.remove('open'); }

function saveBundle() {
  const name_ar = document.getElementById('bundleNameAr').value.trim();
  const name_en = document.getElementById('bundleNameEn').value.trim();
  const bundlePrice = parseFloat(document.getElementById('bundlePrice').value);
  const showErr = msg => { document.getElementById('bundleErrorMsg').textContent = msg; document.getElementById('bundleError').style.display = 'block'; };

  if (!name_ar || !name_en) return showErr('يرجى إدخال اسم الباقة بالعربي والإنجليزي');
  if (!currentBundleItems.length) return showErr('يرجى إضافة منتج واحد على الأقل للباقة');
  if (!bundlePrice || bundlePrice <= 0) return showErr('يرجى إدخال سعر صحيح للباقة');

  const bundleExpiryVal = document.getElementById('bundleExpiry').value;
  if (bundleExpiryVal && new Date(bundleExpiryVal) <= new Date()) return showErr('تاريخ الانتهاء يجب أن يكون بالمستقبل');

  const data = {
    type: 'bundle',
    name_ar, name_en,
    desc_ar: document.getElementById('bundleDescAr').value.trim(),
    desc_en: document.getElementById('bundleDescEn').value.trim(),
    items: currentBundleItems.map(it => ({...it})),
    bundlePrice,
    points: parseInt(document.getElementById('bundlePoints').value) || 0,
    image: currentBundleImage || null,
    icon: '🎁',
    expiresAt: bundleExpiryVal ? new Date(bundleExpiryVal).toISOString() : null,
    showInBanner: document.getElementById('bundleShowBanner').checked,
  };

  const editId = parseInt(document.getElementById('bundleId').value) || null;
  if (editId) {
    const idx = offers.findIndex(o => o.id === editId);
    if (idx !== -1) offers[idx] = { ...offers[idx], ...data };
    showToast('✅ تم تعديل الباقة', 'success');
  } else {
    const newId = offers.length ? Math.max(...offers.map(o => o.id)) + 1 : 1;
    offers.push({ id: newId, ...data, active: true, createdAt: new Date().toISOString() });
    showToast('✅ تم إضافة الباقة', 'success');
  }
  saveOffers();
  document.getElementById('bundleError').style.display = 'none';
  closeBundleModal();
  renderAdminOffers();
  renderOffers();
  initOffersTicker();
}

// =====================
