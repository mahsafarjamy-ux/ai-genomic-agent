"""Payment boundary regressions; Stripe network calls are mocked."""
import hashlib
import hmac
import json
import time
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from api.routers import billing as b
from core.flow.db import Base, User


@pytest.fixture
def env(tmp_path, monkeypatch):
    engine = create_engine('sqlite:///' + str(tmp_path / 'billing.db'), connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    monkeypatch.setattr(b, 'SessionLocal', factory)
    for key, value in {'STRIPE_SECRET_KEY':'sk_test_fake', 'STRIPE_WEBHOOK_SECRET':'whsec_fake',
                       'STRIPE_PRICE_ESSENTIAL':'price_essential', 'STRIPE_PRICE_COMPLETE':'price_complete',
                       'STRIPE_PRICE_LIFETIME':'price_lifetime', 'FRONTEND_URL':'https://bioverse.example'}.items():
        monkeypatch.setenv(key, value)
    with factory() as db:
        db.add(User(id='u1', email='test@example.com', name='Test', password_hash='unused',
                    token='token', stripe_customer_id='cus_test', plan='free'))
        db.commit()
    prices = {name: {'id':'price_'+name, 'active':True, 'type':'one_time', 'unit_amount':amount,
                     'currency':'cad'} for name, amount in [('essential',7900),('complete',19900),('lifetime',39900)]}
    monkeypatch.setattr(b._stripe.Price, 'retrieve', lambda ident: prices[ident.removeprefix('price_')])
    created = []
    def create(**kwargs):
        created.append(kwargs)
        return SimpleNamespace(url='https://checkout.stripe.com/test')
    monkeypatch.setattr(b._stripe.checkout.Session, 'create', create)
    session = {'id':'cs_test','mode':'payment','status':'complete','payment_status':'paid',
               'metadata':{'user_id':'u1','plan':'essential'},'customer':'cus_test','client_reference_id':'u1',
               'line_items':{'data':[{'quantity':1,'price':{'id':'price_essential'}}]}}
    monkeypatch.setattr(b._stripe.checkout.Session, 'retrieve', lambda *args, **kwargs: session)
    app=FastAPI(); app.include_router(b.router, prefix='/api/billing')
    client=TestClient(app)
    def webhook(valid=True):
        payload=json.dumps({'type':'checkout.session.completed','data':{'object':session}}).encode()
        stamp=str(int(time.time()))
        sig=hmac.new(b'whsec_fake',stamp.encode()+b'.'+payload,hashlib.sha256).hexdigest()
        return client.post('/api/billing/webhook', content=payload,
                           headers={'stripe-signature':f't={stamp},v1={sig if valid else "bad"}'})
    yield SimpleNamespace(client=client, factory=factory, session=session, prices=prices, created=created,
                          headers={'Authorization':'Bearer token'}, webhook=webhook, patch=monkeypatch)
    engine.dispose()


def test_catalog_and_checkout_price_binding(env):
    e=env
    assert e.client.get('/api/billing/plans').json()['plans'][0] == {'id':'essential','amount':7900,'currency':'cad'}
    url='/api/billing/checkout?plan=essential&expected_amount=7900&expected_currency=cad'
    assert e.client.post(url, headers=e.headers).status_code == 200
    assert e.created[0]['line_items'] == [{'price':'price_essential','quantity':1}]
    assert e.created[0]['client_reference_id'] == 'u1'
    assert e.created[0]['success_url'].startswith('https://bioverse.example/')
    assert e.client.post(url.replace('7900','2900'), headers=e.headers).status_code == 409
    assert len(e.created) == 1
    assert e.client.post(url, headers={'Authorization':'Bearer wrong'}).status_code == 401


def test_incomplete_configuration_blocks_charge(env):
    e=env
    e.patch.delenv('STRIPE_WEBHOOK_SECRET')
    assert e.client.post('/api/billing/checkout?plan=essential',headers=e.headers).status_code == 503
    assert not e.created
    e.patch.delenv('STRIPE_SECRET_KEY')
    assert e.client.get('/api/billing/plans').status_code == 503


def test_invalid_return_origin_and_recurring_price(env):
    e=env
    e.patch.setenv('FRONTEND_URL','https://bioverse.example/redirect')
    assert e.client.post('/api/billing/checkout?plan=essential',headers=e.headers).status_code == 503
    e.prices['essential']['type']='recurring'
    assert e.client.get('/api/billing/plans').status_code == 503
    assert not e.created


def test_webhook_signature_payment_matching_and_replay(env):
    e=env
    assert e.webhook(False).status_code == 400
    e.session['payment_status']='unpaid'
    assert e.webhook().status_code == 200
    with e.factory() as db: assert db.get(User,'u1').plan == 'free'
    e.session['payment_status']='paid'; e.session['customer']='cus_other'
    assert e.webhook().status_code == 400
    e.session['customer']='cus_test'; e.session['line_items']['data'][0]['price']['id']='price_wrong'
    assert e.webhook().status_code == 400
    e.session['line_items']['data'][0]['price']['id']='price_essential'
    assert e.webhook().status_code == 200
    with e.factory() as db:
        user=db.get(User,'u1'); key=user.license_key
        assert user.plan == 'essential' and key
        user.plan='lifetime'; db.commit()
    assert e.webhook().status_code == 200
    with e.factory() as db:
        assert db.get(User,'u1').plan == 'lifetime'
        assert db.get(User,'u1').license_key == key
