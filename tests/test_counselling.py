"""Public API tests with real transactional SQLite; providers are test doubles."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from types import SimpleNamespace
import json
import hashlib
import hmac
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.routers import counselling as c, auth
from core.flow.db import Base, User
from core.counselling.models import Profile, Slot, Booking, Consultant


@pytest.fixture
def env(tmp_path, monkeypatch):
    engine = create_engine('sqlite:///' + str(tmp_path / 'test.db'), connect_args={'check_same_thread': False})
    factory = sessionmaker(bind=engine, autoflush=False)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(c, 'SessionLocal', factory)
    monkeypatch.setattr(auth, 'SessionLocal', factory)
    monkeypatch.setenv('COUNSELLING_ENABLED', 'true')
    monkeypatch.setenv('COUNSELLING_ADMIN_EMAILS', 'admin@example.com')
    monkeypatch.setenv('STRIPE_SECRET_KEY', 'sk_test_not_real')
    monkeypatch.setenv('COUNSELLING_STRIPE_WEBHOOK_SECRET', 'whsec_test')
    monkeypatch.setenv('DAILY_API_KEY', 'test')
    monkeypatch.setenv('FRONTEND_URL', 'https://bioverse.example.com')
    clock = [1900000000]
    monkeypatch.setattr(c, 'now', lambda: clock[0])
    codes = {}
    monkeypatch.setattr(c.providers, 'send_verification', lambda email, code: codes.update({email: code}))
    sessions = {}
    def create(**kw):
        ident = 'cs_' + kw['metadata']['counselling_booking_id']
        sessions.setdefault(ident, {'id': ident, 'url': 'https://checkout.stripe.com/test',
            'status': 'open', 'payment_status': 'unpaid', 'metadata': kw['metadata'],
            'client_reference_id': kw['client_reference_id'], 'amount_total': kw['line_items'][0]['price_data']['unit_amount'],
            'currency': kw['line_items'][0]['price_data']['currency']})
        return sessions[ident]
    monkeypatch.setattr(c.providers.stripe.checkout.Session, 'create', create)
    monkeypatch.setattr(c.providers.stripe.checkout.Session, 'retrieve', lambda ident: sessions[ident])
    monkeypatch.setattr(c.providers, 'meeting_url', lambda *args: 'https://test.daily.co/private?t=secret')
    app = FastAPI()
    app.include_router(c.router, prefix='/api/counselling')
    app.include_router(auth.router, prefix='/api/auth')
    client = TestClient(app)
    def user(email, verify=True):
        r = client.post('/api/counselling/register', json={'name': email.split('@')[0], 'email': email, 'password': 'a-long-strong-password'})
        assert r.status_code == 200, r.text
        header = {'Authorization': 'Bearer ' + r.json()['token']}
        if verify:
            assert client.post('/api/counselling/verification/send', headers=header).status_code == 200
            assert client.post('/api/counselling/verification/confirm', headers=header, json={'code': codes[email]}).status_code == 200
        return header
    admin = user('admin@example.com')
    consultant = client.post('/api/counselling/admin/consultants', headers=admin, json={
        'name': 'Test Consultant', 'email': 'consultant@example.com', 'credentials': 'Test credentials',
        'bio': 'Test only', 'duration_minutes': 60, 'price_cents': 20000, 'currency': 'cad'}).json()
    def slot(offset=7200):
        r = client.post('/api/counselling/admin/slots', headers=admin, json={'consultant_id': consultant['id'],
             'starts_at': datetime.fromtimestamp(clock[0]+offset, timezone.utc).isoformat(),
             'ends_at': datetime.fromtimestamp(clock[0]+offset+3600, timezone.utc).isoformat()})
        assert r.status_code == 200, r.text
        return r.json()['id']
    def consent(header):
        version = client.get('/api/counselling/config').json()['consent_version']
        return client.post('/api/counselling/consent', headers=header, json={'version':version, 'accepted':True})
    def webhook(session, kind='checkout.session.completed'):
        payload = json.dumps({'type':kind,'data':{'object':session}}).encode()
        timestamp = int(time.time())
        sig = hmac.new(b'whsec_test', str(timestamp).encode()+b'.'+payload, hashlib.sha256).hexdigest()
        return client.post('/api/counselling/stripe/webhook', content=payload, headers={'stripe-signature':f't={timestamp},v1={sig}'})
    yield SimpleNamespace(client=client, factory=factory, clock=clock, codes=codes, sessions=sessions, user=user,
                          admin=admin, consultant=consultant, slot=slot, consent=consent, webhook=webhook, monkeypatch=monkeypatch)
    engine.dispose()


def test_registration_verification_and_shared_login(env):
    e=env; h=e.user('new@example.com', False)
    assert e.client.get('/api/counselling/me', headers=h).json()['verified'] is False
    assert e.consent(h).status_code == 403
    assert e.client.post('/api/counselling/verification/send', headers=h).status_code == 200
    assert e.client.post('/api/counselling/verification/send', headers=h).status_code == 429
    assert e.client.post('/api/counselling/verification/confirm', headers=h, json={'code':e.codes['new@example.com']}).status_code == 200
    assert e.client.post('/api/counselling/verification/confirm', headers=h, json={'code':e.codes['new@example.com']}).status_code == 400
    assert e.consent(h).status_code == 200
    r=e.client.post('/api/auth/login',json={'email':'new@example.com','password':'a-long-strong-password'})
    assert r.status_code == 200
    with e.factory() as db:
        assert db.query(User).filter_by(email='new@example.com').one().password_hash.startswith('scrypt:')


def test_verification_attempt_limit_expiry_and_auth(env):
    e=env; h=e.user('new@example.com',False)
    assert e.client.get('/api/counselling/me').status_code==401
    e.client.post('/api/counselling/verification/send',headers=h)
    wrong = '00000000' if e.codes['new@example.com'] != '00000000' else '11111111'
    for _ in range(5):
        assert e.client.post('/api/counselling/verification/confirm',headers=h,json={'code':wrong}).status_code==400
    assert e.client.post('/api/counselling/verification/confirm',headers=h,json={'code':e.codes['new@example.com']}).status_code==400
    e.clock[0]+=61
    e.client.post('/api/counselling/verification/send',headers=h)
    e.clock[0]+=901
    assert e.client.post('/api/counselling/verification/confirm',headers=h,json={'code':e.codes['new@example.com']}).status_code==400
    assert e.client.get('/api/counselling/admin/consultants',headers=h).status_code==403


def test_consent_version_and_booking_gates(env):
    e=env; h=e.user('new@example.com'); slot=e.slot()
    assert e.client.post('/api/counselling/bookings',headers=h,json={'slot_id':slot}).status_code==403
    assert e.consent(h).status_code==200
    e.monkeypatch.setenv('COUNSELLING_CONSENT_TEXT','Updated wording')
    assert e.client.get('/api/counselling/me',headers=h).json()['consented'] is False
    assert e.client.post('/api/counselling/bookings',headers=h,json={'slot_id':slot}).status_code==403
    e.consent(h)
    e.monkeypatch.setenv('COUNSELLING_ENABLED','false')
    assert e.client.post('/api/counselling/bookings',headers=h,json={'slot_id':slot}).status_code==503


def test_booking_payment_webhook_and_privacy(env):
    e=env; h=e.user('patient@example.com'); stranger=e.user('stranger@example.com'); e.consent(h)
    slot=e.slot(); r=e.client.post('/api/counselling/bookings',headers=h,json={'slot_id':slot}); assert r.status_code==200,r.text
    ident=r.json()['id']; session=e.sessions['cs_'+ident]
    assert e.client.post('/api/counselling/bookings/'+ident+'/join',headers=h).status_code==403
    assert e.webhook(session).status_code==200 # incomplete payments do not fulfil
    assert e.client.get('/api/counselling/bookings',headers=h).json()[0]['status']=='pending_payment'
    assert e.client.post('/api/counselling/stripe/webhook',json={}).status_code==400
    bad={**session,'status':'complete','payment_status':'paid','amount_total':1}
    assert e.webhook(bad).status_code==400
    session.update(status='complete',payment_status='paid')
    assert e.webhook(session).status_code==200
    assert e.webhook(session).status_code==200
    assert e.client.get('/api/counselling/bookings',headers=stranger).json()==[]
    assert e.client.post('/api/counselling/bookings/'+ident+'/join',headers=stranger).status_code==404
    assert e.client.post('/api/counselling/bookings/'+ident+'/join',headers=h).status_code==403
    e.clock[0]+=7200
    joined=e.client.post('/api/counselling/bookings/'+ident+'/join',headers=h)
    assert joined.status_code==200,joined.text
    assert joined.headers['cache-control']=='no-store'
    clinician=e.user('consultant@example.com')
    assert e.client.post('/api/counselling/bookings/'+ident+'/join',headers=clinician).status_code==200
    e.clock[0]+=4501
    assert e.client.post('/api/counselling/bookings/'+ident+'/join',headers=h).status_code==403


def test_expiry_only_releases_confirmed_expired_checkout(env):
    e=env; h=e.user('patient@example.com'); other=e.user('other@example.com'); e.consent(h);e.consent(other)
    slot=e.slot(20000);r=e.client.post('/api/counselling/bookings',headers=h,json={'slot_id':slot});ident=r.json()['id'];session=e.sessions['cs_'+ident]
    e.clock[0]+=2000
    assert e.client.post('/api/counselling/bookings',headers=other,json={'slot_id':slot}).status_code==409
    session['status']='expired'
    assert e.webhook(session,'checkout.session.expired').status_code==200
    assert e.client.post('/api/counselling/bookings',headers=other,json={'slot_id':slot}).status_code==200
    assert e.webhook(session,'checkout.session.expired').status_code==200
    with e.factory() as db:
        assert db.get(Slot,slot).booking_id!=ident


def test_concurrent_booking_claim_and_overlap(env):
    e=env; a=e.user('one@example.com');b=e.user('two@example.com');e.consent(a);e.consent(b);slot=e.slot()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda header:e.client.post('/api/counselling/bookings',headers=header,json={'slot_id':slot}).status_code,[a,b]))
    assert sorted(results)==[200,409]
    overlap=e.client.post('/api/counselling/admin/slots',headers=e.admin,json={'consultant_id':e.consultant['id'],
        'starts_at':datetime.fromtimestamp(e.clock[0]+7500,timezone.utc).isoformat(),
        'ends_at':datetime.fromtimestamp(e.clock[0]+11100,timezone.utc).isoformat()})
    assert overlap.status_code==409
    assert e.client.delete('/api/counselling/admin/slots/'+slot,headers=e.admin).status_code==409


def test_provider_failure_preserves_claim_and_retry_is_idempotent(env):
    e=env;h=e.user('patient@example.com');e.consent(h);slot=e.slot()
    original=c.providers.stripe.checkout.Session.create
    def uncertain(**kw):
        original(**kw)
        raise TimeoutError('Unknown outcome')
    e.monkeypatch.setattr(c.providers.stripe.checkout.Session,'create',uncertain)
    assert e.client.post('/api/counselling/bookings',headers=h,json={'slot_id':slot}).status_code==503
    booking=e.client.get('/api/counselling/bookings',headers=h).json()[0]
    with e.factory() as db:
        assert db.get(Slot,slot).booking_id==booking['id']
    e.monkeypatch.setattr(c.providers.stripe.checkout.Session,'create',original)
    assert e.client.post('/api/counselling/bookings/'+booking['id']+'/retry-payment',headers=h).status_code==200
    assert len(e.sessions)==1


def test_referral_and_cancellation(env):
    e=env;h=e.user('patient@example.com');data={'referrer_name':'Doctor','referrer_email':'doc@example.com','reference':'REF123'}
    assert e.client.post('/api/counselling/referral',headers=h,json=data).status_code==403
    e.consent(h);assert e.client.post('/api/counselling/referral',headers=h,json=data).status_code==200
    slot=e.slot();r=e.client.post('/api/counselling/bookings',headers=h,json={'slot_id':slot});ident=r.json()['id'];session=e.sessions['cs_'+ident]
    session.update(status='complete',payment_status='paid');e.webhook(session)
    assert e.client.post('/api/counselling/bookings/'+ident+'/cancel-request',headers=h).status_code==200
    assert e.webhook(session).status_code==200
    assert e.client.get('/api/counselling/bookings',headers=h).json()[0]['status']=='cancellation_requested'


def test_expired_checkout_retry_reconciles_and_releases(env):
    e=env;h=e.user('patient@example.com');e.consent(h);slot=e.slot()
    ident=e.client.post('/api/counselling/bookings',headers=h,json={'slot_id':slot}).json()['id']
    e.sessions['cs_'+ident]['status']='expired'
    assert e.client.post('/api/counselling/bookings/'+ident+'/retry-payment',headers=h).status_code==409
    with e.factory() as db:
        assert db.get(Slot,slot).booking_id is None
        assert db.get(Booking,ident).status=='expired'


def test_admin_reconcile_missing_session_and_refund(env):
    e=env;h=e.user('patient@example.com');e.consent(h);slot=e.slot(20000)
    original=c.providers.stripe.checkout.Session.create
    e.monkeypatch.setattr(c.providers.stripe.checkout.Session,'create',lambda **kw: (_ for _ in ()).throw(TimeoutError()))
    assert e.client.post('/api/counselling/bookings',headers=h,json={'slot_id':slot}).status_code==503
    ident=e.client.get('/api/counselling/bookings',headers=h).json()[0]['id']
    path='/api/counselling/admin/bookings/'+ident+'/reconcile'
    assert e.client.post(path,headers=h).status_code==403
    assert e.client.post(path,headers=e.admin).status_code==409
    e.clock[0]+=2000
    e.monkeypatch.setattr(c.providers.stripe.checkout.Session,'list',lambda **kw:SimpleNamespace(auto_paging_iter=lambda:iter([])))
    assert e.client.post(path,headers=e.admin).status_code==200
    with e.factory() as db:
        assert db.get(Slot,slot).booking_id is None
    e.monkeypatch.setattr(c.providers.stripe.checkout.Session,'create',original)
    ident=e.client.post('/api/counselling/bookings',headers=h,json={'slot_id':slot}).json()['id'];session=e.sessions['cs_'+ident]
    session.update(status='complete',payment_status='paid',payment_intent='pi_test');e.webhook(session)
    e.monkeypatch.setattr(c.providers.stripe.PaymentIntent,'retrieve',lambda ident:{'latest_charge':'ch_test'})
    e.monkeypatch.setattr(c.providers.stripe.Charge,'retrieve',lambda ident:{'refunded':False,'amount_refunded':0,'currency':'cad'})
    cancel='/api/counselling/admin/bookings/'+ident+'/complete-cancellation'
    assert e.client.post(cancel,headers=e.admin).status_code==409
    e.monkeypatch.setattr(c.providers.stripe.Charge,'retrieve',lambda ident:{'refunded':True,'amount_refunded':20000,'currency':'cad'})
    assert e.client.post(cancel,headers=e.admin).status_code==200
    assert e.client.post(cancel,headers=e.admin).status_code==200
    with e.factory() as db:
        assert db.get(Slot,slot).booking_id is None
        assert db.get(Booking,ident).status=='cancelled'


def test_referral_scope_and_admin_listing(env):
    e=env; patient=e.user('patient@example.com'); clinician=e.user('consultant@example.com'); stranger=e.user('stranger@example.com');e.consent(patient)
    data={'referrer_name':'Doctor','referrer_email':'doc@example.com','reference':'BEFORE'}
    e.client.post('/api/counselling/referral',headers=patient,json=data)
    slot=e.slot();ident=e.client.post('/api/counselling/bookings',headers=patient,json={'slot_id':slot}).json()['id']
    path='/api/counselling/bookings/'+ident+'/referral'
    assert e.client.get(path,headers=clinician).status_code==403
    session=e.sessions['cs_'+ident];session.update(status='complete',payment_status='paid');e.webhook(session)
    e.clock[0]+=1
    e.client.post('/api/counselling/referral',headers=patient,json={**data,'reference':'FUTURE'})
    assert [r['reference'] for r in e.client.get(path,headers=clinician).json()]==['BEFORE']
    assert e.client.get(path,headers=stranger).status_code==404
    assert e.client.get('/api/counselling/admin/bookings',headers=patient).status_code==403
    listing=e.client.get('/api/counselling/admin/bookings',headers=e.admin).json()
    assert listing[0]['patient_name']=='patient'
    assert 'checkout_url' not in listing[0]


def test_daily_private_room_and_expiring_tokens(monkeypatch):
    import httpx
    from core.counselling import providers
    monkeypatch.setenv('DAILY_API_KEY','test-only')
    actual_client=httpx.Client
    calls=[]
    def handle(request):
        calls.append(request)
        if request.method=='GET': return httpx.Response(404)
        if request.url.path.endswith('/rooms'): return httpx.Response(200,json={'privacy':'private','url':'https://test.daily.co/bv-opaque'})
        return httpx.Response(200,json={'token':'temporary'})
    monkeypatch.setattr(providers.httpx,'Client',lambda **kw:actual_client(**kw,transport=httpx.MockTransport(handle)))
    url=providers.meeting_url('opaque','user-opaque',False,1900000000,1900003600)
    assert url=='https://test.daily.co/bv-opaque?t=temporary'
    room=json.loads(calls[1].content); token=json.loads(calls[2].content)['properties']
    assert room['privacy']=='private'
    assert room['properties']['max_participants']==2
    assert room['properties']['enable_recording'] is False
    assert token['is_owner'] is False
    assert token['room_name']=='bv-opaque'
    assert token['nbf']==1899999400
    assert token['exp']==1900004500
    assert token['eject_at_token_exp'] is True
    assert token['enable_recording_ui'] is False


def test_email_provider_fails_closed_without_configuration(monkeypatch):
    from core.counselling import providers
    from fastapi import HTTPException
    monkeypatch.delenv('COUNSELLING_SMTP_HOST',raising=False)
    monkeypatch.delenv('COUNSELLING_EMAIL_FROM',raising=False)
    with pytest.raises(HTTPException) as exc:
        providers.send_verification('test@example.com','12345678')
    assert exc.value.status_code==503
